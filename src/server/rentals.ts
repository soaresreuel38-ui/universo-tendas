import type { PrismaClient } from "@prisma/client";
import {
  CHECKIN_STATUSES,
  COMMITTING_STATUSES,
  EDITABLE_STATUSES,
  RENTAL_STATUS_LABEL,
  canTransition,
  type RentalStatus,
} from "@/lib/domain";
import { seq } from "@/lib/format";
import { availabilityForPeriod, lockProducts } from "./availability";
import { assertCan, DomainError, type Actor, type Db } from "./errors";
import { applyStock, pickUnits, setUnitsStatus, withTx } from "./stock";
import { audit } from "./audit";
import { syncContractsWithRental } from "./contract-sync";

export type RentalItemInput = { productId: string; quantity: number; unitPriceCents: number };

export type RentalInput = {
  customerId: string;
  eventName: string;
  eventAddress?: string | null;
  setupAt?: Date | null;
  departureAt: Date;
  eventAt?: Date | null;
  expectedReturnAt: Date;
  pickupBy?: string | null;
  teardownAt?: Date | null;
  paymentTerms?: string | null;
  discountCents?: number;
  notes?: string | null;
  items: RentalItemInput[];
};

export type NewRentalStatus = "ORCAMENTO" | "RESERVADA" | "CONFIRMADA" | "SAIU";

/** Seleção opcional de unidades numeradas na saída: productId → ids das unidades. */
export type UnitSelection = Record<string, string[]>;

// ───────────────────────── Validações ─────────────────────────

function validateInput(input: RentalInput) {
  if (!input.customerId) throw new DomainError("Selecione o cliente.");
  if (!input.eventName.trim()) throw new DomainError("Informe o evento.");
  if (!(input.departureAt instanceof Date) || Number.isNaN(input.departureAt.getTime())) throw new DomainError("Data de saída inválida.");
  if (!(input.expectedReturnAt instanceof Date) || Number.isNaN(input.expectedReturnAt.getTime())) {
    throw new DomainError("Data prevista de retorno inválida.");
  }
  if (input.expectedReturnAt <= input.departureAt) throw new DomainError("O retorno previsto precisa ser depois da saída.");
  if (input.items.length === 0) throw new DomainError("Adicione ao menos um produto.");
  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.productId)) throw new DomainError("Há produtos repetidos na lista. Some as quantidades em uma única linha.");
    seen.add(item.productId);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new DomainError("As quantidades precisam ser inteiras e maiores que zero.");
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) throw new DomainError("Valor unitário inválido.");
  }
  if ((input.discountCents ?? 0) < 0) throw new DomainError("Desconto inválido.");
}

function totalFor(items: RentalItemInput[], discountCents = 0) {
  const gross = items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
  return Math.max(0, gross - discountCents);
}

async function assertRentableProducts(tx: Db, items: RentalItemInput[]) {
  const products = await tx.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  for (const item of items) {
    const p = products.find((x) => x.id === item.productId);
    if (!p) throw new DomainError("Produto não encontrado.");
    if (!p.active) throw new DomainError(`${p.name} está desativado.`);
    if (p.kind === "SALE") throw new DomainError(`${p.name} é cadastrado somente para venda.`);
  }
}

/**
 * Bloqueia a operação se algum produto não tiver estoque livre no período.
 * Deve ser chamada com os produtos já travados (lockProducts) na mesma transação.
 */
export async function assertBookable(
  tx: Db,
  items: Array<{ productId: string; quantity: number }>,
  from: Date,
  to: Date,
  excludeRentalId?: string,
) {
  const availability = await availabilityForPeriod(
    tx,
    items.map((i) => i.productId),
    from,
    to,
    { excludeRentalId },
  );
  for (const item of items) {
    const a = availability.get(item.productId);
    const free = a?.free ?? 0;
    if (item.quantity > free) {
      throw new DomainError(
        `Não há estoque suficiente para o período selecionado${a ? ` — ${a.name}` : ""}. Disponibilidade atual: ${free} ${free === 1 ? "unidade" : "unidades"}.`,
      );
    }
  }
}

async function lockRental(tx: Db, rentalId: string) {
  await tx.$queryRaw`SELECT id FROM "Rental" WHERE id = ${rentalId} FOR UPDATE`;
  const rental = await tx.rental.findUnique({
    where: { id: rentalId },
    include: { items: { include: { product: true, units: { include: { unit: true } } } } },
  });
  if (!rental) throw new DomainError("Locação não encontrada.");
  return rental;
}

// ───────────────────────── Criar / editar ─────────────────────────

export async function createRental(
  db: PrismaClient,
  actor: Actor,
  input: RentalInput & { status: NewRentalStatus; unitSelection?: UnitSelection },
) {
  assertCan(actor, "rental.manage");
  validateInput(input);
  const { status, unitSelection, items, discountCents = 0, ...data } = input;
  return withTx(db, async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new DomainError("Cliente não encontrado.");
    await assertRentableProducts(tx, items);
    if (status !== "ORCAMENTO") {
      await lockProducts(tx, items.map((i) => i.productId));
      await assertBookable(tx, items, input.departureAt, input.expectedReturnAt);
    }
    const rental = await tx.rental.create({
      data: {
        ...data,
        discountCents,
        totalCents: totalFor(items, discountCents),
        status: status === "SAIU" ? "CONFIRMADA" : status,
        createdById: actor.id,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceCents: i.unitPriceCents })) },
      },
    });
    const qty = items.reduce((s, i) => s + i.quantity, 0);
    await audit(tx, {
      userId: actor.id,
      action: "rental.create",
      entityType: "Rental",
      entityId: rental.id,
      summary: `${status === "ORCAMENTO" ? "Criou o orçamento" : "Reservou"} #${seq(rental.number)} — ${rental.eventName} (${qty} itens)`,
    });
    if (status === "SAIU") await departInTx(tx, actor, rental.id, { unitSelection });
    return tx.rental.findUniqueOrThrow({ where: { id: rental.id }, include: { items: true } });
  });
}

export async function updateRental(db: PrismaClient, actor: Actor, rentalId: string, input: RentalInput) {
  assertCan(actor, "rental.manage");
  validateInput(input);
  const { items, discountCents = 0, ...data } = input;
  return withTx(db, async (tx) => {
    const rental = await lockRental(tx, rentalId);
    if (!EDITABLE_STATUSES.includes(rental.status)) {
      throw new DomainError(`Locação com status "${RENTAL_STATUS_LABEL[rental.status]}" não pode mais ter itens ou datas alterados.`);
    }
    await assertRentableProducts(tx, items);
    if (COMMITTING_STATUSES.includes(rental.status)) {
      await lockProducts(tx, [...items.map((i) => i.productId), ...rental.items.map((i) => i.productId)]);
      await assertBookable(tx, items, input.departureAt, input.expectedReturnAt, rental.id);
    }
    await tx.rentalItem.deleteMany({ where: { rentalId } });
    await audit(tx, { userId: actor.id, action: "rental.update", entityType: "Rental", entityId: rentalId, summary: `Alterou a locação #${seq(rental.number)}` });
    return tx.rental.update({
      where: { id: rentalId },
      data: {
        ...data,
        discountCents,
        totalCents: totalFor(items, discountCents),
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceCents: i.unitPriceCents })) },
      },
      include: { items: true },
    });
  });
}

// ───────────────────────── Saída (produtos deixam o depósito) ─────────────────────────

async function departInTx(
  tx: Db,
  actor: Actor,
  rentalId: string,
  opts: { unitSelection?: UnitSelection; pickupBy?: string | null; now?: Date },
) {
  const now = opts.now ?? new Date();
  const rental = await lockRental(tx, rentalId);
  if (!canTransition(rental.status, "SAIU")) {
    throw new DomainError(`Não é possível registrar a saída de uma locação "${RENTAL_STATUS_LABEL[rental.status]}".`);
  }
  if (rental.items.length === 0) throw new DomainError("A locação não tem produtos.");
  if (rental.expectedReturnAt <= now) {
    throw new DomainError("O retorno previsto já passou. Atualize as datas da locação antes de registrar a saída.");
  }
  await lockProducts(tx, rental.items.map((i) => i.productId));

  // Saída antecipada ocupa o estoque desde agora.
  const departureAt = rental.departureAt > now ? now : rental.departureAt;
  await assertBookable(tx, rental.items, departureAt, rental.expectedReturnAt, rental.id);

  for (const item of rental.items) {
    const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
    if (!product.active) throw new DomainError(`${product.name} está desativado.`);
    if (product.qtyAvailable < item.quantity) {
      throw new DomainError(
        `Estoque insuficiente no depósito para ${product.name}. Disponível agora: ${product.qtyAvailable} unidade(s).`,
      );
    }
    let unitNote: string | null = null;
    if (product.trackingMode === "UNIT") {
      const units = await pickUnits(tx, product.id, "AVAILABLE", item.quantity, opts.unitSelection?.[product.id]);
      await tx.rentalItemUnit.createMany({ data: units.map((u) => ({ rentalItemId: item.id, unitId: u.id })) });
      await setUnitsStatus(tx, units.map((u) => u.id), "RENTED");
      unitNote = `Unidades: ${units.map((u) => `#${u.code}`).join(", ")}`;
    }
    await applyStock(
      tx,
      product.id,
      { available: -item.quantity, rented: item.quantity },
      {
        type: "SAIDA_LOCACAO",
        quantity: item.quantity,
        userId: actor.id,
        rentalId: rental.id,
        reason: `Locação #${seq(rental.number)} — ${rental.eventName}`,
        notes: unitNote,
        occurredAt: now,
      },
    );
  }
  await syncContractsWithRental(tx, rental.id, "departed");
  await audit(tx, {
    userId: actor.id,
    action: "rental.depart",
    entityType: "Rental",
    entityId: rental.id,
    summary: `Registrou a saída da locação #${seq(rental.number)} (${rental.items.reduce((s, i) => s + i.quantity, 0)} itens)`,
  });
  return tx.rental.update({
    where: { id: rental.id },
    data: {
      status: "SAIU",
      departedAt: now,
      departureAt,
      pickupBy: opts.pickupBy?.trim() ? opts.pickupBy.trim() : rental.pickupBy,
    },
  });
}

export async function departRental(
  db: PrismaClient,
  actor: Actor,
  rentalId: string,
  opts: { unitSelection?: UnitSelection; pickupBy?: string | null; now?: Date } = {},
) {
  assertCan(actor, "rental.manage");
  return withTx(db, (tx) => departInTx(tx, actor, rentalId, opts));
}

// ───────────────────────── Mudança de status ─────────────────────────

export async function changeRentalStatus(db: PrismaClient, actor: Actor, rentalId: string, to: RentalStatus) {
  assertCan(actor, "rental.manage");
  if (to === "SAIU") return departRental(db, actor, rentalId);
  if (to === "CONFERIDA") throw new DomainError("Use a tela de conferência para registrar o retorno dos produtos.");
  return withTx(db, async (tx) => {
    const rental = await lockRental(tx, rentalId);
    if (!canTransition(rental.status, to)) {
      throw new DomainError(`Não é possível mudar de "${RENTAL_STATUS_LABEL[rental.status]}" para "${RENTAL_STATUS_LABEL[to]}".`);
    }
    // Sair do orçamento passa a ocupar estoque: validar disponibilidade.
    if (rental.status === "ORCAMENTO" && COMMITTING_STATUSES.includes(to)) {
      await lockProducts(tx, rental.items.map((i) => i.productId));
      await assertBookable(tx, rental.items, rental.departureAt, rental.expectedReturnAt, rental.id);
    }
    if (to === "CANCELADA") await syncContractsWithRental(tx, rentalId, "canceled");
    if (to === "FINALIZADA") await syncContractsWithRental(tx, rentalId, "finalized");
    await audit(tx, {
      userId: actor.id,
      action: "rental.status",
      entityType: "Rental",
      entityId: rentalId,
      summary: `Locação #${seq(rental.number)}: ${RENTAL_STATUS_LABEL[rental.status]} → ${RENTAL_STATUS_LABEL[to]}`,
    });
    return tx.rental.update({
      where: { id: rentalId },
      data: {
        status: to,
        ...(to === "CANCELADA" ? { canceledAt: new Date() } : {}),
        ...(to === "RETORNADA" ? { actualReturnAt: rental.actualReturnAt ?? new Date() } : {}),
      },
    });
  });
}

// ───────────────────────── Conferência de retorno ─────────────────────────

export type UnitReturnState = "OK" | "DANIFICADA" | "FALTANTE";

export type CheckInItem = {
  itemId: string;
  good: number;
  damaged: number;
  missing: number;
  note?: string | null;
  /** Para produtos numerados: estado de cada unidade que saiu (unitId → estado). */
  unitStates?: Record<string, UnitReturnState>;
  /** Registro do problema quando há danificados. */
  damage?: { damageType: string; responsible?: string | null; photoIds?: string[] } | null;
};

export type CheckInInput = {
  items: CheckInItem[];
  notes?: string | null;
  photoIds?: string[];
  returnedAt?: Date | null;
};

export async function checkInRental(db: PrismaClient, actor: Actor, rentalId: string, input: CheckInInput) {
  assertCan(actor, "rental.checkin");
  return withTx(db, async (tx) => {
    const rental = await lockRental(tx, rentalId);
    if (!CHECKIN_STATUSES.includes(rental.status)) {
      throw new DomainError(`A locação está "${RENTAL_STATUS_LABEL[rental.status]}" e não pode ser conferida.`);
    }
    await lockProducts(tx, rental.items.map((i) => i.productId));

    const byId = new Map(input.items.map((i) => [i.itemId, i]));
    if (byId.size !== input.items.length) throw new DomainError("Itens da conferência repetidos.");
    for (const id of byId.keys()) {
      if (!rental.items.some((i) => i.id === id)) throw new DomainError("A conferência contém um item que não pertence a esta locação.");
    }

    const reference = `Locação #${seq(rental.number)} — ${rental.eventName}`;
    const now = new Date();

    for (const item of rental.items) {
      const check = byId.get(item.id);
      if (!check) throw new DomainError(`Confira o item ${item.product.name}.`);
      let { good, damaged, missing } = check;

      // Produtos numerados: as quantidades vêm do estado de cada unidade.
      const unitGroups: Record<UnitReturnState, string[]> = { OK: [], DANIFICADA: [], FALTANTE: [] };
      if (item.units.length > 0) {
        for (const ru of item.units) {
          const state = check.unitStates?.[ru.unitId];
          if (!state || !(state in unitGroups)) throw new DomainError(`Informe a situação da unidade #${ru.unit.code} (${item.product.name}).`);
          unitGroups[state].push(ru.unitId);
        }
        good = unitGroups.OK.length;
        damaged = unitGroups.DANIFICADA.length;
        missing = unitGroups.FALTANTE.length;
      }

      for (const n of [good, damaged, missing]) {
        if (!Number.isInteger(n) || n < 0) throw new DomainError(`Quantidades inválidas em ${item.product.name}.`);
      }
      if (good + damaged + missing !== item.quantity) {
        throw new DomainError(
          `${item.product.name}: retornadas (${good}) + danificadas (${damaged}) + faltantes (${missing}) precisa ser igual ao enviado (${item.quantity}).`,
        );
      }
      const note = check.note?.trim() || null;
      if ((damaged > 0 || missing > 0) && !note) {
        throw new DomainError(`Justifique a diferença em ${item.product.name} antes de finalizar a conferência.`);
      }

      const base = { userId: actor.id, rentalId: rental.id, reason: reference, notes: note, occurredAt: now };
      if (good > 0) {
        await applyStock(tx, item.productId, { rented: -good, available: good }, { ...base, type: "RETORNO_LOCACAO", quantity: good });
      }
      if (damaged > 0) {
        if (unitGroups.DANIFICADA.length) {
          for (const unitId of unitGroups.DANIFICADA) {
            await tx.maintenance.create({
              data: { productId: item.productId, unitId, rentalId: rental.id, quantity: 1, reason: `Danificado — ${reference}`, notes: note, userId: actor.id },
            });
          }
        } else {
          await tx.maintenance.create({
            data: { productId: item.productId, rentalId: rental.id, quantity: damaged, reason: `Danificado — ${reference}`, notes: note, userId: actor.id },
          });
        }
        await applyStock(tx, item.productId, { rented: -damaged, maintenance: damaged }, { ...base, type: "DANIFICADO_RETORNO", quantity: damaged });
        const damageType = check.damage?.damageType?.trim();
        if (!damageType) throw new DomainError(`Informe o tipo de dano em ${item.product.name}.`);
        const report = await tx.damageReport.create({
          data: {
            rentalId: rental.id,
            rentalItemId: item.id,
            productId: item.productId,
            quantity: damaged,
            damageType: damageType.slice(0, 80),
            description: note ?? "",
            responsible: check.damage?.responsible?.trim() || null,
            reportedById: actor.id,
          },
        });
        const damagePhotos = check.damage?.photoIds ?? [];
        if (damagePhotos.length) {
          await tx.photo.updateMany({ where: { id: { in: damagePhotos }, damageReportId: null }, data: { damageReportId: report.id, rentalId: rental.id } });
        }
      }
      if (missing > 0) {
        await applyStock(tx, item.productId, { rented: -missing, pending: missing }, { ...base, type: "PENDENCIA", quantity: missing });
      }

      if (item.units.length > 0) {
        await setUnitsStatus(tx, unitGroups.OK, "AVAILABLE");
        await setUnitsStatus(tx, unitGroups.DANIFICADA, "MAINTENANCE");
        await setUnitsStatus(tx, unitGroups.FALTANTE, "PENDING");
        for (const ru of item.units) {
          const state = check.unitStates![ru.unitId];
          await tx.rentalItemUnit.update({ where: { id: ru.id }, data: { returnState: state } });
        }
      }

      await tx.rentalItem.update({
        where: { id: item.id },
        data: { qtyReturned: good, qtyDamaged: damaged, qtyMissing: missing, checkNote: note },
      });
    }

    if (input.photoIds?.length) {
      await tx.photo.updateMany({ where: { id: { in: input.photoIds }, rentalId: null }, data: { rentalId: rental.id } });
    }

    await syncContractsWithRental(tx, rental.id, "checked_in");
    const damagedTotal = input.items.reduce((s, i) => s + (i.damaged || 0), 0);
    await audit(tx, {
      userId: actor.id,
      action: "rental.checkin",
      entityType: "Rental",
      entityId: rental.id,
      summary: `Conferiu o retorno da locação #${seq(rental.number)}${damagedTotal ? " com ocorrências" : " sem ocorrências"}`,
    });
    return tx.rental.update({
      where: { id: rental.id },
      data: {
        status: "CONFERIDA",
        actualReturnAt: input.returnedAt ?? rental.actualReturnAt ?? now,
        checkedById: actor.id,
        checkedAt: now,
        checkNotes: input.notes?.trim() || null,
      },
      include: { items: true },
    });
  });
}
