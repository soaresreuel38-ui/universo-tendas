import "server-only";
import { MOVEMENT_LABEL, RENTAL_STATUS_LABEL, effectiveStatus } from "@/lib/domain";
import { fmtDateTime, seq } from "@/lib/format";
import { DATE_KEY_RE, addDays, startOfDay, startOfMonthKey, startOfWeekKey, todayKey } from "@/lib/time";
import { prisma } from "./db";

export type Period = { key: string; from: string; to: string; start: Date; end: Date; label: string };

export function resolvePeriod(p?: string, de?: string, ate?: string): Period {
  const today = todayKey();
  let from = today;
  let to = today;
  let key = p ?? "mes";
  if (key === "hoje") {
    from = to = today;
  } else if (key === "semana") {
    from = startOfWeekKey(today);
    to = addDays(from, 6);
  } else if (key === "personalizado" && de && ate && DATE_KEY_RE.test(de) && DATE_KEY_RE.test(ate) && de <= ate) {
    from = de;
    to = ate;
  } else {
    key = "mes";
    from = startOfMonthKey(today);
    const [y, m] = from.split("-").map(Number);
    to = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
  }
  const f = (k: string) => k.split("-").reverse().join("/");
  return { key, from, to, start: startOfDay(from), end: startOfDay(addDays(to, 1)), label: from === to ? f(from) : `${f(from)} a ${f(to)}` };
}

const BILLABLE = { notIn: ["ORCAMENTO", "CANCELADA"] as ("ORCAMENTO" | "CANCELADA")[] };

export async function reportData(period: Period) {
  const range = { gte: period.start, lt: period.end };
  const [rentals, sales, movements, topRented, topSold, maintenanceOpen, losses] = await Promise.all([
    prisma.rental.findMany({
      where: { departureAt: range, status: BILLABLE },
      include: { customer: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
      orderBy: { departureAt: "asc" },
    }),
    prisma.sale.findMany({
      where: { soldAt: range },
      include: { customer: { select: { name: true } }, user: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
      orderBy: { soldAt: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { occurredAt: range },
      include: { product: { select: { name: true } }, user: { select: { name: true } }, rental: { select: { number: true } }, sale: { select: { number: true } } },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.rentalItem.groupBy({
      by: ["productId"],
      where: { rental: { departureAt: range, status: BILLABLE } },
      _sum: { quantity: true },
      _count: { rentalId: true },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { soldAt: range, status: "CONCLUIDA" } },
      _sum: { quantity: true },
    }),
    prisma.maintenance.findMany({ where: { status: "ABERTA" }, include: { product: { select: { name: true } }, unit: { select: { code: true } } }, orderBy: { openedAt: "asc" } }),
    prisma.stockMovement.findMany({
      where: { occurredAt: range, type: { in: ["PERDA", "PENDENCIA", "PENDENCIA_PERDIDA", "DANIFICADO_RETORNO", "DESCARTE_MANUTENCAO"] } },
      include: { product: { select: { name: true } }, user: { select: { name: true } }, rental: { select: { number: true } } },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  const productIds = [...new Set([...topRented.map((t) => t.productId), ...topSold.map((t) => t.productId)])];
  const names = new Map((await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));

  // Faturamento de vendas considera itens (sem desconto) para o ranking e o total da venda para o faturamento.
  const saleRevenue = new Map<string, number>();
  for (const s of sales) if (s.status === "CONCLUIDA") for (const i of s.items) saleRevenue.set(i.productId, (saleRevenue.get(i.productId) ?? 0) + i.quantity * i.unitPriceCents);
  const rentRevenue = new Map<string, number>();
  for (const r of rentals) for (const i of r.items) rentRevenue.set(i.productId, (rentRevenue.get(i.productId) ?? 0) + i.quantity * i.unitPriceCents);

  const customers = new Map<string, { key: string; name: string; rentals: number; sales: number; total: number }>();
  for (const r of rentals) {
    const c = customers.get(r.customerId) ?? { key: r.customerId, name: r.customer.name, rentals: 0, sales: 0, total: 0 };
    c.rentals++;
    c.total += r.totalCents;
    customers.set(r.customerId, c);
  }
  for (const s of sales) {
    if (s.status !== "CONCLUIDA") continue;
    const k = s.customerId ?? `avulso:${s.customerName ?? ""}`;
    const c = customers.get(k) ?? { key: k, name: s.customer?.name ?? s.customerName ?? "Venda avulsa", rentals: 0, sales: 0, total: 0 };
    c.sales++;
    c.total += s.totalCents;
    customers.set(k, c);
  }

  const movementSummary = new Map<string, { count: number; qty: number }>();
  for (const m of movements) {
    const s = movementSummary.get(m.type) ?? { count: 0, qty: 0 };
    s.count++;
    s.qty += m.quantity;
    movementSummary.set(m.type, s);
  }

  return {
    rentals,
    sales,
    movements,
    movementSummary: [...movementSummary.entries()].map(([type, v]) => ({ type, label: MOVEMENT_LABEL[type as keyof typeof MOVEMENT_LABEL], ...v })),
    topRented: topRented
      .map((t) => ({ productId: t.productId, name: names.get(t.productId) ?? "?", qty: t._sum.quantity ?? 0, rentals: t._count.rentalId, revenue: rentRevenue.get(t.productId) ?? 0 }))
      .sort((a, b) => b.qty - a.qty),
    topSold: topSold
      .map((t) => ({ productId: t.productId, name: names.get(t.productId) ?? "?", qty: t._sum.quantity ?? 0, revenue: saleRevenue.get(t.productId) ?? 0 }))
      .sort((a, b) => b.qty - a.qty),
    maintenanceOpen,
    losses,
    customers: [...customers.values()].sort((a, b) => b.total - a.total),
    rentalRevenue: rentals.reduce((s, r) => s + r.totalCents, 0),
    saleRevenue: sales.filter((s) => s.status === "CONCLUIDA").reduce((s, x) => s + x.totalCents, 0),
  };
}

export type ReportData = Awaited<ReturnType<typeof reportData>>;

const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** Tabelas para exportação (CSV com ; e BOM — abre direto no Excel em português). */
export function reportTable(kind: string, d: ReportData): { name: string; header: string[]; rows: Array<Array<string | number>> } | null {
  switch (kind) {
    case "movimentacoes":
      return {
        name: "movimentacoes",
        header: ["Data", "Produto", "Operação", "Quantidade", "Variação depósito", "Saldo total", "Usuário", "Motivo", "Referência", "Observação"],
        rows: d.movements.map((m) => [
          fmtDateTime(m.occurredAt),
          m.product.name,
          MOVEMENT_LABEL[m.type],
          m.quantity,
          m.delta,
          m.totalAfter,
          m.user.name,
          m.reason ?? "",
          m.rental ? `Locação #${seq(m.rental.number)}` : m.sale ? `Venda #${seq(m.sale.number)}` : "",
          m.notes ?? "",
        ]),
      };
    case "locacoes":
      return {
        name: "locacoes",
        header: ["Nº", "Cliente", "Evento", "Saída", "Retorno previsto", "Retorno real", "Status", "Produtos", "Valor (R$)"],
        rows: d.rentals.map((r) => [
          seq(r.number),
          r.customer.name,
          r.eventName,
          fmtDateTime(r.departureAt),
          fmtDateTime(r.expectedReturnAt),
          fmtDateTime(r.actualReturnAt),
          RENTAL_STATUS_LABEL[effectiveStatus(r)],
          r.items.map((i) => `${i.quantity} ${i.product.name}`).join(", "),
          money(r.totalCents),
        ]),
      };
    case "vendas":
      return {
        name: "vendas",
        header: ["Nº", "Data", "Cliente", "Produtos", "Responsável", "Status", "Valor (R$)"],
        rows: d.sales.map((s) => [
          seq(s.number),
          fmtDateTime(s.soldAt),
          s.customer?.name ?? s.customerName ?? "Venda avulsa",
          s.items.map((i) => `${i.quantity} ${i.product.name}`).join(", "),
          s.user.name,
          s.status === "CANCELADA" ? "Cancelada" : "Concluída",
          money(s.totalCents),
        ]),
      };
    case "mais-alugados":
      return { name: "produtos-mais-alugados", header: ["Produto", "Quantidade alugada", "Nº de locações", "Faturamento (R$)"], rows: d.topRented.map((t) => [t.name, t.qty, t.rentals, money(t.revenue)]) };
    case "mais-vendidos":
      return { name: "produtos-mais-vendidos", header: ["Produto", "Quantidade vendida", "Faturamento (R$)"], rows: d.topSold.map((t) => [t.name, t.qty, money(t.revenue)]) };
    case "manutencao":
      return {
        name: "em-manutencao",
        header: ["Produto", "Unidade", "Quantidade", "Motivo", "Desde"],
        rows: d.maintenanceOpen.map((m) => [m.product.name, m.unit ? `#${m.unit.code}` : "", m.quantity, m.reason, fmtDateTime(m.openedAt)]),
      };
    case "perdas":
      return {
        name: "perdidos-danificados",
        header: ["Data", "Produto", "Ocorrência", "Quantidade", "Locação", "Usuário", "Observação"],
        rows: d.losses.map((m) => [fmtDateTime(m.occurredAt), m.product.name, MOVEMENT_LABEL[m.type], m.quantity, m.rental ? `#${seq(m.rental.number)}` : "", m.user.name, m.notes ?? m.reason ?? ""]),
      };
    case "clientes":
      return { name: "clientes", header: ["Cliente", "Locações", "Compras", "Total (R$)"], rows: d.customers.map((c) => [c.name, c.rentals, c.sales, money(c.total)]) };
    default:
      return null;
  }
}

export function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  const esc = (v: string | number) => {
    let s = String(v);
    // Evita injeção de fórmulas ao abrir no Excel.
    if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
