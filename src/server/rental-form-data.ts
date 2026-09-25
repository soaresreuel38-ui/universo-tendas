import "server-only";
import { prisma } from "./db";
import { customerOptions } from "./options";

export async function rentalFormOptions() {
  const [customers, products] = await Promise.all([
    customerOptions(),
    prisma.product.findMany({ where: { active: true, kind: { in: ["RENTAL", "BOTH"] } }, orderBy: { name: "asc" } }),
  ]);
  return {
    customers,
    products: products.map((p) => ({
      value: p.id,
      label: p.name,
      sub: `${p.sku} · ${p.category}`,
      unit: p.unit,
      rentalPriceCents: p.rentalPriceCents,
    })),
  };
}
