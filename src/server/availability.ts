import { Prisma } from "@prisma/client";
import { COMMITTING_STATUSES, RESERVING_STATUSES, isOut, type RentalStatus } from "@/lib/domain";
import type { Db } from "./errors";

/**
 * Disponibilidade por data.
 *
 * Capacidade de locação de um produto = no depósito (qtyAvailable) + fora em locação (qtyRented).
 * Itens em manutenção ou pendentes não entram, porque não há garantia de que estarão prontos.
 *
 * Cada locação ativa ocupa [saída, retorno previsto). Se os produtos já saíram e o retorno
 * previsto venceu, a ocupação se estende até agora (o item ainda não voltou).
 * Livre no período = capacidade − pico de ocupação simultânea dentro do período.
 */

export type Interval = { start: number; end: number; qty: number };

/** Pico de ocupação simultânea dentro de [from, to). Intervalos são semiabertos. */
export function peakUsage(intervals: Interval[], from: number, to: number): number {
  const events: Array<[number, number]> = [];
  for (const i of intervals) {
    const s = Math.max(i.start, from);
    const e = Math.min(i.end, to);
    if (s < e && i.qty > 0) {
      events.push([s, i.qty]);
      events.push([e, -i.qty]);
    }
  }
  // No mesmo instante, o que termina libera antes do que começa.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    if (current > peak) peak = current;
  }
  return peak;
}

export type CommitmentRow = {
  productId: string;
  quantity: number;
  rentalId: string;
  status: RentalStatus;
  departureAt: Date;
  expectedReturnAt: Date;
};

export function toInterval(row: CommitmentRow, now: Date): Interval {
  const end = isOut(row.status) ? Math.max(row.expectedReturnAt.getTime(), now.getTime() + 1) : row.expectedReturnAt.getTime();
  return { start: row.departureAt.getTime(), end, qty: row.quantity };
}

async function commitments(
  db: Db,
  productIds: string[],
  from: Date,
  to: Date,
  opts: { excludeRentalId?: string; now: Date },
): Promise<CommitmentRow[]> {
  if (productIds.length === 0) return [];
  const items = await db.rentalItem.findMany({
    where: {
      productId: { in: productIds },
      rental: {
        status: { in: COMMITTING_STATUSES },
        departureAt: { lt: to },
        ...(opts.excludeRentalId ? { id: { not: opts.excludeRentalId } } : {}),
      },
    },
    select: {
      productId: true,
      quantity: true,
      rental: { select: { id: true, status: true, departureAt: true, expectedReturnAt: true } },
    },
  });
  return items
    .map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      rentalId: i.rental.id,
      status: i.rental.status as RentalStatus,
      departureAt: i.rental.departureAt,
      expectedReturnAt: i.rental.expectedReturnAt,
    }))
    .filter((row) => toInterval(row, opts.now).end > from.getTime());
}

export type ProductAvailability = {
  productId: string;
  name: string;
  capacity: number;
  peak: number;
  free: number;
  qtyAvailable: number;
};

/** Quanto de cada produto está livre para uma locação no período [from, to). */
export async function availabilityForPeriod(
  db: Db,
  productIds: string[],
  from: Date,
  to: Date,
  opts: { excludeRentalId?: string; now?: Date } = {},
): Promise<Map<string, ProductAvailability>> {
  const now = opts.now ?? new Date();
  const ids = [...new Set(productIds)];
  const [products, rows] = await Promise.all([
    db.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, qtyAvailable: true, qtyRented: true },
    }),
    commitments(db, ids, from, to, { excludeRentalId: opts.excludeRentalId, now }),
  ]);
  const result = new Map<string, ProductAvailability>();
  const end = Math.max(to.getTime(), from.getTime() + 1);
  for (const p of products) {
    const capacity = p.qtyAvailable + p.qtyRented;
    const intervals = rows.filter((r) => r.productId === p.id).map((r) => toInterval(r, now));
    const peak = peakUsage(intervals, from.getTime(), end);
    result.set(p.id, { productId: p.id, name: p.name, capacity, peak, free: Math.max(0, capacity - peak), qtyAvailable: p.qtyAvailable });
  }
  return result;
}

/**
 * Quantas unidades podem sair do estoque por tempo indeterminado a partir de agora
 * (venda, perda, manutenção) sem deixar nenhuma reserva futura descoberta.
 */
export async function removableNow(db: Db, productId: string, now: Date = new Date()): Promise<number> {
  const far = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 20);
  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    select: { qtyAvailable: true, qtyRented: true },
  });
  const rows = await commitments(db, [productId], now, far, { now });
  const peak = peakUsage(
    rows.map((r) => toInterval(r, now)),
    now.getTime(),
    far.getTime(),
  );
  const capacity = product.qtyAvailable + product.qtyRented;
  return Math.max(0, Math.min(product.qtyAvailable, capacity - peak));
}

/** Soma reservada (locações confirmadas que ainda não saíram), por produto. */
export async function reservedByProduct(db: Db, productIds?: string[]): Promise<Map<string, number>> {
  const rows = await db.rentalItem.groupBy({
    by: ["productId"],
    where: {
      ...(productIds ? { productId: { in: productIds } } : {}),
      rental: { status: { in: [...RESERVING_STATUSES] } },
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

/**
 * Trava as linhas dos produtos até o fim da transação (SELECT … FOR UPDATE), sempre na mesma
 * ordem para evitar deadlock. Duas pessoas reservando o mesmo produto ao mesmo tempo passam
 * a ser atendidas uma de cada vez, e a segunda já enxerga a reserva da primeira.
 */
export async function lockProducts(db: Db, productIds: string[]) {
  const ids = [...new Set(productIds)].sort();
  if (ids.length === 0) return;
  await db.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
}
