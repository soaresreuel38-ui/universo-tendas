import "server-only";
import { money } from "@/lib/format";
import { reservedByProduct, removableNow } from "./availability";
import { prisma } from "./db";

/** Produtos ativos para os seletores dos formulários de estoque. */
export async function stockProductOptions({ withUnits = false, withRemovable = false } = {}) {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: withUnits ? { units: { where: { status: "AVAILABLE" }, select: { id: true, code: true } } } : undefined,
  });
  const reserved = await reservedByProduct(prisma, products.map((p) => p.id));
  const removable = new Map<string, number>();
  if (withRemovable) {
    for (const p of products) removable.set(p.id, await removableNow(prisma, p.id));
  }
  return products.map((p) => {
    const free = withRemovable ? (removable.get(p.id) ?? 0) : Math.max(0, p.qtyAvailable - (reserved.get(p.id) ?? 0));
    const units = "units" in p ? (p.units as Array<{ id: string; code: string }>) : undefined;
    return {
      value: p.id,
      label: p.name,
      sub: `${p.sku} · ${p.category}`,
      right: `${free} disp.`,
      unit: p.unit,
      qtyAvailable: p.qtyAvailable,
      free,
      trackingMode: p.trackingMode,
      kind: p.kind,
      rentalPriceCents: p.rentalPriceCents,
      salePriceCents: p.salePriceCents,
      priceLabel: money(p.rentalPriceCents),
      units: units?.sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true })),
    };
  });
}

export async function customerOptions() {
  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, whatsapp: true, document: true },
  });
  return customers.map((c) => ({
    value: c.id,
    label: c.name,
    sub: [c.phone ?? c.whatsapp, c.document].filter(Boolean).join(" · ") || undefined,
  }));
}
