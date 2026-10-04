import type { PrismaClient, ProductKind, TrackingMode } from "@prisma/client";
import { assertCan, DomainError, type Actor, type Db } from "./errors";
import { applyStock, createUnits, totalOf, withTx } from "./stock";

export type ProductInput = {
  name: string;
  sku: string;
  category: string;
  kind: ProductKind;
  trackingMode: TrackingMode;
  description?: string | null;
  unit: string;
  salePriceCents?: number | null;
  rentalPriceCents?: number | null;
  monthlyPriceCents?: number | null;
  photoId?: string | null;
  notes?: string | null;
  dimensions?: string | null;
  minStock: number;
  active: boolean;
  /** Endereço público (/tendas/<slug>). Vazio = gerado a partir do nome. */
  slug?: string | null;
  showOnSite?: boolean;
  featured?: boolean;
};

function validate(input: ProductInput) {
  if (!input.name.trim()) throw new DomainError("Informe o nome do produto.");
  if (!input.sku.trim()) throw new DomainError("Informe o código/SKU.");
  if (!input.category.trim()) throw new DomainError("Informe a categoria.");
  if (!Number.isInteger(input.minStock) || input.minStock < 0) throw new DomainError("Estoque mínimo inválido.");
}

export async function createProduct(
  db: PrismaClient,
  actor: Actor,
  input: ProductInput & { initialQty?: number },
) {
  assertCan(actor, "product.manage");
  validate(input);
  const { initialQty = 0, ...data } = input;
  if (!Number.isInteger(initialQty) || initialQty < 0) throw new DomainError("Quantidade inicial inválida.");
  return withTx(db, async (tx) => {
    const product = await tx.product.create({ data: { ...data, sku: data.sku.trim().toUpperCase(), slug: await uniqueSlug(tx, data.slug, data.name) } });
    if (initialQty > 0) {
      const units = product.trackingMode === "UNIT" ? await createUnits(tx, product.id, initialQty) : [];
      await applyStock(
        tx,
        product.id,
        { available: initialQty },
        {
          type: "ENTRADA",
          quantity: initialQty,
          userId: actor.id,
          reason: "Estoque inicial",
          notes: units.length ? `Unidades: ${units.map((u) => `#${u.code}`).join(", ")}` : null,
        },
      );
    }
    return product;
  });
}

/** Edita o cadastro. Quantidades só mudam por movimentação (entrada, saída, ajuste) — o histórico é preservado. */
export async function updateProduct(db: PrismaClient, actor: Actor, productId: string, input: ProductInput) {
  assertCan(actor, "product.manage");
  validate(input);
  return withTx(db, async (tx) => {
    const current = await tx.product.findUnique({ where: { id: productId }, include: { _count: { select: { units: true } } } });
    if (!current) throw new DomainError("Produto não encontrado.");
    if (current.trackingMode !== input.trackingMode && (totalOf(current) > 0 || current._count.units > 0)) {
      throw new DomainError("O modo de controle só pode ser alterado enquanto o produto não tem estoque nem unidades cadastradas.");
    }
    return tx.product.update({
      where: { id: productId },
      data: { ...input, sku: input.sku.trim().toUpperCase(), slug: await uniqueSlug(tx, input.slug ?? current.slug, input.name, productId) },
    });
  });
}

/**
 * Produtos com histórico nunca são apagados (o histórico precisa continuar existindo):
 * são desativados. Sem nenhum uso, o cadastro é excluído.
 */
export async function deleteOrDeactivateProduct(db: PrismaClient, actor: Actor, productId: string) {
  assertCan(actor, "product.manage");
  return withTx(db, async (tx) => {
    const p = await tx.product.findUnique({
      where: { id: productId },
      include: { _count: { select: { movements: true, rentalItems: true, saleItems: true, maintenances: true } } },
    });
    if (!p) throw new DomainError("Produto não encontrado.");
    const used = p._count.movements + p._count.rentalItems + p._count.saleItems + p._count.maintenances > 0;
    if (used) {
      await tx.product.update({ where: { id: productId }, data: { active: false } });
      return "deactivated" as const;
    }
    await tx.productUnit.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
    return "deleted" as const;
  });
}

export async function setProductActive(db: PrismaClient, actor: Actor, productId: string, active: boolean) {
  assertCan(actor, "product.manage");
  return db.product.update({ where: { id: productId }, data: { active } });
}

export async function updateUnitNotes(db: PrismaClient, actor: Actor, unitId: string, notes: string | null) {
  assertCan(actor, "product.manage");
  return db.productUnit.update({ where: { id: unitId }, data: { notes } });
}

/** "Tenda Piramidal 5x5" → "tenda-piramidal-5x5". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/** Slug único: usa o informado (ou o nome) e acrescenta -2, -3… se já existir em outro produto. */
export async function uniqueSlug(tx: Db, wanted: string | null | undefined, name: string, productId?: string): Promise<string> {
  const base = slugify(wanted?.trim() || name) || "produto";
  for (let n = 1; n < 200; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await tx.product.findFirst({ where: { slug: candidate, ...(productId ? { id: { not: productId } } : {}) }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new DomainError("Não foi possível gerar o endereço da página do produto. Informe outro.");
}
