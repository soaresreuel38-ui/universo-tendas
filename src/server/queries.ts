import "server-only";
import type { Prisma } from "@prisma/client";
import { COMMITTING_STATUSES, RESERVING_STATUSES } from "@/lib/domain";
import { addDays, dayRange, todayKey } from "@/lib/time";
import { reservedByProduct } from "./availability";
import { prisma } from "./db";

export const rentalListInclude = {
  customer: { select: { id: true, name: true, phone: true, whatsapp: true } },
  items: { select: { quantity: true, product: { select: { id: true, name: true, unit: true, photoId: true } } } },
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
  const tomorrow = dayRange(addDays(todayKey(now), 1));
  const [stock, ops, tomorrowDepartures, openMaintenance] = await Promise.all([
    stockOverview(),
    todayOperations(now),
    prisma.rental.findMany({
      where: { status: { in: [...RESERVING_STATUSES] }, departureAt: { gte: tomorrow.start, lt: tomorrow.end } },
      include: rentalListInclude,
      orderBy: { departureAt: "asc" },
    }),
    prisma.maintenance.count({ where: { status: "ABERTA" } }),
  ]);
  const sum = (f: (p: (typeof stock)[number]) => number) => stock.reduce((s, p) => s + f(p), 0);
  return {
    ...ops,
    stock,
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
    tomorrowDepartures,
    openMaintenance,
    overdueUnits: ops.overdue.reduce((t, r) => t + r.items.reduce((u, i) => u + i.quantity, 0), 0),
  };
}

/** Locações com valor em aberto (total maior que os pagamentos registrados). */
export async function pendingPayments() {
  const rentals = await prisma.rental.findMany({
    where: { status: { in: [...RESERVING_STATUSES, ...ACTIVE_OUT, "RETORNADA", "CONFERIDA"] }, totalCents: { gt: 0 } },
    include: rentalListInclude,
    orderBy: { departureAt: "asc" },
    take: 300,
  });
  const paid = await prisma.payment.groupBy({ by: ["rentalId"], where: { rentalId: { in: rentals.map((r) => r.id) } }, _sum: { amountCents: true } });
  const map = new Map(paid.map((p) => [p.rentalId, p._sum.amountCents ?? 0]));
  return rentals
    .map((r) => ({ rental: r, openCents: r.totalCents - (map.get(r.id) ?? 0) }))
    .filter((x) => x.openCents > 0);
}

/** Pendências de documentação: o que falta para a locação sair com contrato assinado. */
export async function pendingContractWork() {
  const [toGenerate, awaitingSignature, quotes] = await Promise.all([
    prisma.rental.findMany({
      where: { status: { in: [...RESERVING_STATUSES] }, contracts: { none: { status: { not: "CANCELADO" } } } },
      include: rentalListInclude,
      orderBy: { departureAt: "asc" },
    }),
    prisma.contract.findMany({
      where: { status: { in: ["RASCUNHO", "ENVIADO", "AGUARDANDO_ASSINATURA"] } },
      include: { customer: { select: { name: true } }, rental: { select: { number: true, eventName: true, departureAt: true, departedAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rental.count({ where: { status: "ORCAMENTO" } }),
  ]);
  return { contractsToGenerate: toGenerate, contractsAwaiting: awaitingSignature, openQuotes: quotes };
}

/** Operação do dia: saídas, retornos, montagens, desmontagens, contratos e atrasados. */
export async function todayOperations(now = new Date()) {
  const { start, end } = dayRange(todayKey(now));
  const [departures, returns, setups, teardowns, overdue, awaitingCheck, work, events, payments] = await Promise.all([
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
      where: { status: { in: COMMITTING_STATUSES }, setupAt: { gte: start, lt: end } },
      include: rentalListInclude,
      orderBy: { setupAt: "asc" },
    }),
    prisma.rental.findMany({
      where: { status: { in: COMMITTING_STATUSES }, teardownAt: { gte: start, lt: end } },
      include: rentalListInclude,
      orderBy: { teardownAt: "asc" },
    }),
    prisma.rental.findMany({ where: { status: { in: [...ACTIVE_OUT] }, expectedReturnAt: { lt: now } }, include: rentalListInclude, orderBy: { expectedReturnAt: "asc" } }),
    prisma.rental.findMany({ where: { status: "RETORNADA" }, include: rentalListInclude, orderBy: { expectedReturnAt: "asc" } }),
    pendingContractWork(),
    prisma.rental.findMany({
      where: { status: { in: COMMITTING_STATUSES }, eventAt: { gte: start, lt: end } },
      include: rentalListInclude,
      orderBy: { eventAt: "asc" },
    }),
    pendingPayments(),
  ]);
  return { departures, returns, setups, teardowns, overdue, awaitingCheck, events, pendingPayments: payments, ...work };
}
