import type { PrismaClient } from "@prisma/client";
import { seq } from "@/lib/format";
import { lockProducts } from "./availability";
import { assertCan, DomainError, type Actor } from "./errors";
import { applyStock, assertRemovable, pickUnits, setUnitsStatus, withTx } from "./stock";
import { audit } from "./audit";
import { addPaymentInTx, type PaymentInput } from "./payments";

export type SaleInput = {
  customerId?: string | null;
  customerName?: string | null;
  soldAt?: Date;
  discountCents?: number;
  notes?: string | null;
  items: Array<{ productId: string; quantity: number; unitPriceCents: number; unitIds?: string[] | null }>;
  /** Pagamento recebido no ato (opcional). */
  payment?: PaymentInput | null;
};

/**
 * Venda: o produto deixa o estoque definitivamente (não há retorno).
 * O total do produto diminui e a quantidade vendida é acumulada.
 */
export async function createSale(db: PrismaClient, actor: Actor, input: SaleInput) {
  assertCan(actor, "sale.create");
  if (input.items.length === 0) throw new DomainError("Adicione ao menos um produto.");
  const seen = new Set<string>();
  for (const i of input.items) {
    if (seen.has(i.productId)) throw new DomainError("Há produtos repetidos na venda.");
    seen.add(i.productId);
    if (!Number.isInteger(i.quantity) || i.quantity <= 0) throw new DomainError("As quantidades precisam ser inteiras e maiores que zero.");
    if (!Number.isInteger(i.unitPriceCents) || i.unitPriceCents < 0) throw new DomainError("Valor unitário inválido.");
  }
  const discountCents = input.discountCents ?? 0;
  if (!Number.isInteger(discountCents) || discountCents < 0) throw new DomainError("Desconto inválido.");

  return withTx(db, async (tx) => {
    if (input.customerId) {
      const c = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!c) throw new DomainError("Cliente não encontrado.");
    }
    await lockProducts(tx, input.items.map((i) => i.productId));
    const products = await tx.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) } } });

    const gross = input.items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
    const sale = await tx.sale.create({
      data: {
        customerId: input.customerId || null,
        customerName: input.customerName?.trim() || null,
        soldAt: input.soldAt ?? new Date(),
        discountCents,
        totalCents: Math.max(0, gross - discountCents),
        notes: input.notes?.trim() || null,
        userId: actor.id,
        items: { create: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceCents: i.unitPriceCents })) },
      },
    });

    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new DomainError("Produto não encontrado.");
      if (!product.active) throw new DomainError(`${product.name} está desativado.`);
      if (product.kind === "RENTAL") {
        throw new DomainError(`${product.name} está cadastrado somente para locação. Altere o tipo para "Locação e venda" para vender.`);
      }
      await assertRemovable(tx, product.id, item.quantity, product.name);
      let notes: string | null = null;
      if (product.trackingMode === "UNIT") {
        const units = await pickUnits(tx, product.id, "AVAILABLE", item.quantity, item.unitIds);
        await setUnitsStatus(tx, units.map((u) => u.id), "SOLD");
        notes = `Unidades: ${units.map((u) => `#${u.code}`).join(", ")}`;
      }
      await applyStock(
        tx,
        product.id,
        { available: -item.quantity, sold: item.quantity },
        { type: "VENDA", quantity: item.quantity, userId: actor.id, saleId: sale.id, reason: `Venda #${seq(sale.number)}`, notes, occurredAt: sale.soldAt },
      );
    }
    if (input.payment) await addPaymentInTx(tx, actor, { saleId: sale.id }, input.payment);
    await audit(tx, {
      userId: actor.id,
      action: "sale.create",
      entityType: "Sale",
      entityId: sale.id,
      summary: `Registrou a venda #${seq(sale.number)} (${input.items.reduce((s, i) => s + i.quantity, 0)} itens)`,
    });
    return tx.sale.findUniqueOrThrow({ where: { id: sale.id }, include: { items: true, payments: true } });
  });
}

/** Cancela a venda e devolve os produtos ao estoque (somente administrador). */
export async function cancelSale(db: PrismaClient, actor: Actor, saleId: string, reason: string) {
  assertCan(actor, "sale.cancel");
  if (!reason.trim()) throw new DomainError("Informe o motivo do cancelamento.");
  return withTx(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;
    const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { items: { include: { product: true } } } });
    if (!sale) throw new DomainError("Venda não encontrada.");
    if (sale.status === "CANCELADA") throw new DomainError("Esta venda já foi cancelada.");
    await lockProducts(tx, sale.items.map((i) => i.productId));

    for (const item of sale.items) {
      if (item.product.trackingMode === "UNIT") {
        // Recupera as unidades registradas na movimentação da venda.
        const mv = await tx.stockMovement.findFirst({ where: { saleId, productId: item.productId, type: "VENDA" } });
        const codes = [...(mv?.notes ?? "").matchAll(/#(\w+)/g)].map((m) => m[1]);
        const units = await tx.productUnit.findMany({ where: { productId: item.productId, code: { in: codes }, status: "SOLD" } });
        await setUnitsStatus(tx, units.map((u) => u.id), "AVAILABLE");
      }
      await applyStock(
        tx,
        item.productId,
        { available: item.quantity, sold: -item.quantity },
        { type: "VENDA_CANCELADA", quantity: item.quantity, userId: actor.id, saleId, reason: `Cancelamento da venda #${seq(sale.number)}`, notes: reason },
      );
    }
    await audit(tx, { userId: actor.id, action: "sale.cancel", entityType: "Sale", entityId: saleId, summary: `Cancelou a venda #${seq(sale.number)}: ${reason}` });
    return tx.sale.update({
      where: { id: saleId },
      data: { status: "CANCELADA", canceledAt: new Date(), notes: [sale.notes, `Cancelada: ${reason}`].filter(Boolean).join(" — ") },
    });
  });
}
