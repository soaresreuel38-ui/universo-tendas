import "server-only";
import type { Prisma } from "@prisma/client";
import { COMMITTING_STATUSES, RESERVING_STATUSES } from "@/lib/domain";
import { addDays, dayRange, todayKey } from "@/lib/time";
import { reservedByProduct } from "./availability";
import { prisma } from "./db";

export const rentalListInclude = {
  customer: { select: { id: true, name: true, phone: true, whatsapp: true } },
  items: { select: { quantity: true, product: { select: { name: true, unit: true } } } },
} satisfies Prisma.RentalInclude;

export type RentalListRow = Prisma.RentalGetPayload<{ include: typeof rentalListInclude }>;

const ACTIVE_OUT = ["SAIU", "EM_EVENTO", "AGUARDANDO_RETORNO", "ATRASADA"] as const;

/** Visão de estoque de cada produto ativo, com a quantidade reservada calculada. */
export async function stockOverview(where: Prisma.ProductWhereInput = { active: true }) {
  const products = await prisma.product.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const reserved = await reservedByProduct(prisma, products.map((p) => p.id));
  return products.map((p) => {
    const r = reserved.get(p.id) ?? 0;
    const total = p.qtyAvailable + p.qtyRented + p.qtyMaintenance + p.qtyPending;
    const free = Math.max(0, p.qtyAvailable - r);
    return { ...p, reserved: r, total, free, low: p.minStock > 0 && free <= p.minStock };
  });
}

export async function dashboardData(now = new Date()) {
  const today = todayKey(now);
  const { start, end } = dayRange(today);
  const tomorrow = dayRange(addDays(today, 1));

  const [stock, departuresToday, returnsToday, overdue, happeningToday, tomorrowDepartures, awaitingCheck, openMaintenance] =
    await Promise.all([
      stockOverview(),
      prisma.rental.findMany({
        where: { status: { in: [...RESERVING_STATUSES] }, departureAt: { lt: end } },
        include: rentalListInclude,
        orderBy: { departureAt: "asc" },
      }),
      prisma.rental.findMany({
        where: { status: { in: [...ACTIVE_OUT] }, expectedReturnAt: { gte: now, lt: end } },
        include: rentalListInclude,
        orderBy: { expectedReturnAt: "asc" },
      }),
      prisma.rental.findMany({
        where: { status: { in: [...ACTIVE_OUT] }, expectedReturnAt: { lt: now } },
        include: rentalListInclude,
        orderBy: { expectedReturnAt: "asc" },
      }),
      prisma.rental.findMany({
        where: {
          status: { in: COMMITTING_STATUSES },
          OR: [{ eventAt: { gte: start, lt: end } }, { departureAt: { lt: end }, expectedReturnAt: { gte: start } }],
        },
        include: rentalListInclude,
        orderBy: { departureAt: "asc" },
      }),
      prisma.rental.findMany({
        where: { status: { in: [...RESERVING_STATUSES] }, departureAt: { gte: tomorrow.start, lt: tomorrow.end } },
        include: rentalListInclude,
        orderBy: { departureAt: "asc" },
      }),
      prisma.rental.findMany({ where: { status: "RETORNADA" }, include: rentalListInclude, orderBy: { expectedReturnAt: "asc" } }),
      prisma.maintenance.count({ where: { status: "ABERTA" } }),
    ]);

  const sum = (f: (p: (typeof stock)[number]) => number) => stock.reduce((s, p) => s + f(p), 0);
  return {
    today,
    totals: {
      products: stock.length,
      total: sum((p) => p.total),
      free: sum((p) => p.free),
      rented: sum((p) => p.qtyRented),
      reserved: sum((p) => p.reserved),
      maintenance: sum((p) => p.qtyMaintenance),
      pending: sum((p) => p.qtyPending),
      sold: sum((p) => p.qtySold),
    },
    lowStock: stock.filter((p) => p.low),
    departuresToday,
    returnsToday,
    overdue,
    happeningToday,
    tomorrowDepartures,
    awaitingCheck,
    openMaintenance,
  };
}
