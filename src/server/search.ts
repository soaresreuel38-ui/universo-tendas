import "server-only";
import { prisma } from "./db";

/** Busca universal: cliente, telefone, CPF/CNPJ, produto, código, locação, contrato, evento e venda. */
export async function globalSearch(raw: string, take = 20) {
  const q = raw.trim().slice(0, 80);
  if (!q) return { q, products: [], customers: [], rentals: [], sales: [], contracts: [] };
  const digits = q.replace(/\D/g, "");
  const num = /^#?\d{1,9}$/.test(q) ? Number(digits) : null;
  const ci = { contains: q, mode: "insensitive" as const };

  const [products, customers, rentals, sales, contracts] = await Promise.all([
        prisma.product.findMany({ where: { OR: [{ name: ci }, { sku: ci }, { category: ci }] }, orderBy: [{ active: "desc" }, { name: "asc" }], take }),
        prisma.customer.findMany({
          where: {
            OR: [
              { name: ci },
              { email: ci },
              { phone: { contains: q } },
              { whatsapp: { contains: q } },
              { document: { contains: q } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }, { document: { contains: digits } }] : []),
            ],
          },
          take,
          orderBy: { name: "asc" },
        }),
        prisma.rental.findMany({
          where: {
            OR: [
              { eventName: ci },
              { eventAddress: ci },
              { customer: { name: ci } },
              { customer: { phone: { contains: q } } },
              { customer: { document: { contains: q } } },
              ...(digits.length >= 4
                ? [{ customer: { phone: { contains: digits } } }, { customer: { whatsapp: { contains: digits } } }, { customer: { document: { contains: digits } } }]
                : []),
              ...(num ? [{ number: num }] : []),
            ],
          },
          include: { customer: { select: { name: true } } },
          orderBy: { departureAt: "desc" },
          take,
        }),
        num ? prisma.sale.findMany({ where: { number: num }, include: { customer: { select: { name: true } } } }) : Promise.resolve([]),
        prisma.contract.findMany({
          where: {
            OR: [
              { customer: { name: ci } },
              { customer: { document: { contains: q } } },
              ...(digits.length >= 4 ? [{ customer: { document: { contains: digits } } }] : []),
              { rental: { eventName: ci } },
              ...(num ? [{ number: num }] : []),
            ],
          },
          include: { customer: { select: { name: true } }, rental: { select: { eventName: true, departureAt: true, departedAt: true } } },
          orderBy: { number: "desc" },
          take,
        }),
  ]);
  return { q, products, customers, rentals, sales, contracts };
}

export type SearchResult = Awaited<ReturnType<typeof globalSearch>>;
