import type { MovementType, PrismaClient, ProductUnit, UnitStatus } from "@prisma/client";
import { ENTRY_REASONS, type EntryReason } from "@/lib/domain";
import { lockProducts, removableNow } from "./availability";
import { assertCan, DomainError, translateDbError, type Actor, type Db } from "./errors";

// ───────────────────────── Infraestrutura ─────────────────────────

export async function withTx<T>(db: PrismaClient, fn: (tx: Db) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(fn, { maxWait: 10_000, timeout: 20_000 });
  } catch (error) {
    translateDbError(error);
  }
}

export type CounterChange = {
  available?: number;
  rented?: number;
  maintenance?: number;
  pending?: number;
  sold?: number;
  lost?: number;
};

export type MovementInput = {
  type: MovementType;
  quantity: number;
  userId: string;
  reason?: string | null;
  notes?: string | null;
  rentalId?: string | null;
  saleId?: string | null;
  unitId?: string | null;
  occurredAt?: Date;
};

/** Aplica a variação nos contadores do produto e registra a movimentação no histórico. */
export async function applyStock(tx: Db, productId: string, change: CounterChange, mv: MovementInput) {
  const p = await tx.product.update({
    where: { id: productId },
    data: {
      qtyAvailable: { increment: change.available ?? 0 },
      qtyRented: { increment: change.rented ?? 0 },
      qtyMaintenance: { increment: change.maintenance ?? 0 },
      qtyPending: { increment: change.pending ?? 0 },
      qtySold: { increment: change.sold ?? 0 },
      qtyLost: { increment: change.lost ?? 0 },
    },
  });
  if (p.qtyAvailable < 0 || p.qtyRented < 0 || p.qtyMaintenance < 0 || p.qtyPending < 0) {
    throw new DomainError(`Estoque insuficiente de ${p.name}: a operação deixaria o saldo negativo.`);
  }
  await tx.stockMovement.create({
    data: {
      productId,
      type: mv.type,
      delta: change.available ?? 0,
      quantity: mv.quantity,
      reason: mv.reason ?? null,
      notes: mv.notes ?? null,
      userId: mv.userId,
      rentalId: mv.rentalId ?? null,
      saleId: mv.saleId ?? null,
      unitId: mv.unitId ?? null,
      availableAfter: p.qtyAvailable,
      totalAfter: p.qtyAvailable + p.qtyRented + p.qtyMaintenance + p.qtyPending,
      occurredAt: mv.occurredAt ?? new Date(),
    },
  });
  return p;
}

export const totalOf = (p: { qtyAvailable: number; qtyRented: number; qtyMaintenance: number; qtyPending: number }) =>
  p.qtyAvailable + p.qtyRented + p.qtyMaintenance + p.qtyPending;

function assertQty(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new DomainError("Informe uma quantidade inteira maior que zero.");
  if (quantity > 100_000) throw new DomainError("Quantidade acima do limite permitido.");
}

async function activeProduct(tx: Db, productId: string) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new DomainError("Produto não encontrado.");
  return product;
}

// ───────────────────────── Unidades numeradas ─────────────────────────

/**
 * Seleciona unidades de um produto com determinado status. Se o usuário indicou quais,
 * valida a escolha; senão pega as de menor código.
 */
export async function pickUnits(
  tx: Db,
  productId: string,
  status: UnitStatus,
  count: number,
  preferredIds?: string[] | null,
): Promise<ProductUnit[]> {
  if (preferredIds && preferredIds.length > 0) {
    const ids = [...new Set(preferredIds)];
    if (ids.length !== count) throw new DomainError(`Selecione exatamente ${count} unidade(s).`);
    const units = await tx.productUnit.findMany({ where: { id: { in: ids }, productId, status } });
    if (units.length !== count) throw new DomainError("Uma ou mais unidades selecionadas não estão disponíveis para esta operação.");
    return units.sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  }
  const units = await tx.productUnit.findMany({ where: { productId, status } });
  units.sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  if (units.length < count) throw new DomainError(`Só há ${units.length} unidade(s) nesta situação.`);
  return units.slice(0, count);
}

export async function setUnitsStatus(tx: Db, unitIds: string[], status: UnitStatus) {
  if (unitIds.length) await tx.productUnit.updateMany({ where: { id: { in: unitIds } }, data: { status } });
}

/** Cria N novas unidades com códigos sequenciais (001, 002…), continuando a numeração existente. */
export async function createUnits(tx: Db, productId: string, count: number): Promise<ProductUnit[]> {
  const existing = await tx.productUnit.findMany({ where: { productId }, select: { code: true } });
  let max = 0;
  for (const u of existing) {
    const n = Number(u.code.replace(/\D/g, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  const codes = Array.from({ length: count }, (_, i) => String(max + i + 1).padStart(3, "0"));
  await tx.productUnit.createMany({ data: codes.map((code) => ({ productId, code })) });
  return tx.productUnit.findMany({ where: { productId, code: { in: codes } }, orderBy: { code: "asc" } });
}

// ───────────────────────── Entrada ─────────────────────────

export type StockEntryInput = {
  productId: string;
  quantity: number;
  reason: EntryReason;
  occurredAt?: Date;
  notes?: string | null;
};

export async function stockEntry(db: PrismaClient, actor: Actor, input: StockEntryInput) {
  assertCan(actor, "stock.entry");
  assertQty(input.quantity);
  if (!(input.reason in ENTRY_REASONS)) throw new DomainError("Motivo de entrada inválido.");
  return withTx(db, async (tx) => {
    await lockProducts(tx, [input.productId]);
    const product = await activeProduct(tx, input.productId);
    if (!product.active) throw new DomainError("Produto desativado. Reative-o antes de movimentar.");
    const units = product.trackingMode === "UNIT" ? await createUnits(tx, product.id, input.quantity) : [];
    return applyStock(
      tx,
      product.id,
      { available: input.quantity },
      {
        type: "ENTRADA",
        quantity: input.quantity,
        userId: actor.id,
        reason: ENTRY_REASONS[input.reason],
        notes: [input.notes, units.length ? `Unidades: ${units.map((u) => `#${u.code}`).join(", ")}` : null]
          .filter(Boolean)
          .join(" — ") || null,
        occurredAt: input.occurredAt,
      },
    );
  });
}

// ───────────────────────── Saídas (manutenção, perda, transferência, outro) ─────────────────────────

export type StockExitKind = "MANUTENCAO" | "PERDA" | "TRANSFERENCIA" | "OUTRO";

export type StockExitInput = {
  productId: string;
  quantity: number;
  kind: StockExitKind;
  reason: string;
  notes?: string | null;
  unitIds?: string[] | null;
  occurredAt?: Date;
};

/** Garante que a saída não deixa reservas futuras sem estoque. */
export async function assertRemovable(tx: Db, productId: string, quantity: number, name: string) {
  const removable = await removableNow(tx, productId);
  if (quantity > removable) {
    throw new DomainError(
      `Estoque insuficiente de ${name}. Disponível para esta operação: ${removable} unidade(s) (já considerando as reservas futuras).`,
    );
  }
}

export async function stockExit(db: PrismaClient, actor: Actor, input: StockExitInput) {
  assertCan(actor, "stock.exit");
  assertQty(input.quantity);
  if (!input.reason.trim()) throw new DomainError("Informe o motivo da saída.");
  return withTx(db, async (tx) => {
    await lockProducts(tx, [input.productId]);
    const product = await activeProduct(tx, input.productId);
    await assertRemovable(tx, product.id, input.quantity, product.name);

    const units =
      product.trackingMode === "UNIT" ? await pickUnits(tx, product.id, "AVAILABLE", input.quantity, input.unitIds) : [];
    const unitNote = units.length ? `Unidades: ${units.map((u) => `#${u.code}`).join(", ")}` : null;
    const notes = [input.notes, unitNote].filter(Boolean).join(" — ") || null;
    const base = { quantity: input.quantity, userId: actor.id, reason: input.reason, notes, occurredAt: input.occurredAt };

    switch (input.kind) {
      case "MANUTENCAO": {
        if (units.length) {
          for (const u of units) {
            await tx.maintenance.create({
              data: { productId: product.id, unitId: u.id, quantity: 1, reason: input.reason, notes: input.notes, userId: actor.id },
            });
          }
          await setUnitsStatus(tx, units.map((u) => u.id), "MAINTENANCE");
        } else {
          await tx.maintenance.create({
            data: { productId: product.id, quantity: input.quantity, reason: input.reason, notes: input.notes, userId: actor.id },
          });
        }
        return applyStock(tx, product.id, { available: -input.quantity, maintenance: input.quantity }, { ...base, type: "ENVIO_MANUTENCAO" });
      }
      case "PERDA":
        await setUnitsStatus(tx, units.map((u) => u.id), "LOST");
        return applyStock(tx, product.id, { available: -input.quantity, lost: input.quantity }, { ...base, type: "PERDA" });
      case "TRANSFERENCIA":
        await setUnitsStatus(tx, units.map((u) => u.id), "LOST");
        return applyStock(tx, product.id, { available: -input.quantity }, { ...base, type: "TRANSFERENCIA" });
      case "OUTRO":
        await setUnitsStatus(tx, units.map((u) => u.id), "LOST");
        return applyStock(tx, product.id, { available: -input.quantity }, { ...base, type: "SAIDA_OUTRA" });
      default:
        throw new DomainError("Tipo de saída inválido.");
    }
  });
}

// ───────────────────────── Manutenção ─────────────────────────

export async function closeMaintenance(
  db: PrismaClient,
  actor: Actor,
  input: { maintenanceId: string; outcome: "CONCLUIDA" | "DESCARTADA"; notes?: string | null; costCents?: number | null },
) {
  assertCan(actor, input.outcome === "DESCARTADA" ? "maintenance.discard" : "maintenance.close");
  return withTx(db, async (tx) => {
    const m = await tx.maintenance.findUnique({ where: { id: input.maintenanceId } });
    if (!m) throw new DomainError("Registro de manutenção não encontrado.");
    await lockProducts(tx, [m.productId]);
    // Relê após a trava: evita concluir duas vezes o mesmo registro.
    const fresh = await tx.maintenance.findUniqueOrThrow({ where: { id: m.id } });
    if (fresh.status !== "ABERTA") throw new DomainError("Esta manutenção já foi encerrada.");
    await tx.maintenance.update({
      where: { id: m.id },
      data: {
        status: input.outcome,
        closedAt: new Date(),
        notes: [fresh.notes, input.notes].filter(Boolean).join(" — ") || null,
        costCents: input.costCents ?? fresh.costCents,
      },
    });
    if (fresh.unitId) await setUnitsStatus(tx, [fresh.unitId], input.outcome === "CONCLUIDA" ? "AVAILABLE" : "LOST");
    const base = { quantity: fresh.quantity, userId: actor.id, reason: fresh.reason, notes: input.notes, unitId: fresh.unitId, rentalId: fresh.rentalId };
    return input.outcome === "CONCLUIDA"
      ? applyStock(tx, fresh.productId, { maintenance: -fresh.quantity, available: fresh.quantity }, { ...base, type: "RETORNO_MANUTENCAO" })
      : applyStock(tx, fresh.productId, { maintenance: -fresh.quantity, lost: fresh.quantity }, { ...base, type: "DESCARTE_MANUTENCAO" });
  });
}

// ───────────────────────── Pendências (faltantes de locação) ─────────────────────────

export async function resolvePending(
  db: PrismaClient,
  actor: Actor,
  input: { rentalItemId: string; quantity: number; outcome: "ENCONTRADO" | "PERDIDO"; notes?: string | null },
) {
  assertCan(actor, input.outcome === "PERDIDO" ? "pending.lost" : "pending.found");
  assertQty(input.quantity);
  return withTx(db, async (tx) => {
    const item = await tx.rentalItem.findUnique({ where: { id: input.rentalItemId }, include: { rental: true } });
    if (!item) throw new DomainError("Item de locação não encontrado.");
    await lockProducts(tx, [item.productId]);
    const fresh = await tx.rentalItem.findUniqueOrThrow({ where: { id: item.id }, include: { units: true } });
    const open = (fresh.qtyMissing ?? 0) - fresh.qtyMissingResolved;
    if (input.quantity > open) throw new DomainError(`Há apenas ${open} unidade(s) pendente(s) neste item.`);
    await tx.rentalItem.update({ where: { id: item.id }, data: { qtyMissingResolved: { increment: input.quantity } } });

    const missingUnits = fresh.units.filter((u) => u.returnState === "FALTANTE").map((u) => u.unitId);
    if (missingUnits.length) {
      const stillPending = await tx.productUnit.findMany({
        where: { id: { in: missingUnits }, status: "PENDING" },
        orderBy: { code: "asc" },
        take: input.quantity,
      });
      await setUnitsStatus(tx, stillPending.map((u) => u.id), input.outcome === "ENCONTRADO" ? "AVAILABLE" : "LOST");
    }

    const base = {
      quantity: input.quantity,
      userId: actor.id,
      rentalId: item.rentalId,
      reason: `Locação #${String(item.rental.number).padStart(6, "0")}`,
      notes: input.notes,
    };
    return input.outcome === "ENCONTRADO"
      ? applyStock(tx, item.productId, { pending: -input.quantity, available: input.quantity }, { ...base, type: "PENDENCIA_ENCONTRADA" })
      : applyStock(tx, item.productId, { pending: -input.quantity, lost: input.quantity }, { ...base, type: "PENDENCIA_PERDIDA" });
  });
}

// ───────────────────────── Ajuste de inventário (administrador) ─────────────────────────

export async function adjustInventory(
  db: PrismaClient,
  actor: Actor,
  input: { productId: string; countedQty: number; reason: string },
) {
  assertCan(actor, "stock.adjust");
  if (!Number.isInteger(input.countedQty) || input.countedQty < 0) throw new DomainError("Quantidade contada inválida.");
  if (!input.reason.trim()) throw new DomainError("Informe o motivo do ajuste.");
  return withTx(db, async (tx) => {
    await lockProducts(tx, [input.productId]);
    const product = await activeProduct(tx, input.productId);
    if (product.trackingMode === "UNIT") {
      throw new DomainError("Produtos controlados por unidade são ajustados unidade a unidade (entrada ou saída).");
    }
    const delta = input.countedQty - product.qtyAvailable;
    if (delta === 0) throw new DomainError("A contagem é igual ao saldo atual; nada a ajustar.");
    await tx.inventoryAdjustment.create({
      data: { productId: product.id, previousQty: product.qtyAvailable, countedQty: input.countedQty, reason: input.reason, userId: actor.id },
    });
    return applyStock(
      tx,
      product.id,
      { available: delta },
      { type: "AJUSTE", quantity: Math.abs(delta), userId: actor.id, reason: input.reason, notes: `Contagem no depósito: ${product.qtyAvailable} → ${input.countedQty}` },
    );
  });
}
