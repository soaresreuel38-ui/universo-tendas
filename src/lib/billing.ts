import { TZ, toDateKey } from "./time";

/** Modalidade da locação: por diária ou por mês. */
export type BillingMode = "DIARIA" | "MENSAL";

export const BILLING_LABEL: Record<BillingMode, string> = { DIARIA: "Locação diária", MENSAL: "Locação mensal" };
export const BILLING_SHORT: Record<BillingMode, string> = { DIARIA: "Diária", MENSAL: "Mensal" };
/** Sufixo do preço de tabela: "/dia" ou "/mês". */
export const BILLING_UNIT: Record<BillingMode, string> = { DIARIA: "/dia", MENSAL: "/mês" };

const DAY = 86_400_000;

/** Soma meses de calendário (05/10 → 05/11), preservando a hora. */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/** Fim do período a partir do início e da quantidade de diárias (24 h cada) ou meses (de calendário). */
export function periodEnd(mode: BillingMode, from: Date, n: number): Date {
  return mode === "MENSAL" ? addMonths(from, n) : new Date(from.getTime() + n * DAY);
}

/** Data de calendário (fuso da empresa) como número de dias, para contar por data e não por hora. */
function dayNumber(d: Date): number {
  const [y, m, dd] = toDateKey(d, TZ).split("-").map(Number);
  return Date.UTC(y, m - 1, dd) / DAY;
}

/**
 * Quantas diárias ou meses cabem no período (sempre ao menos 1), contando por DATA, sem olhar a hora.
 * Diária: diferença entre as datas (05→06 = 1, 05→07 = 2, mesmo dia = 1).
 * Mensal: meses de calendário (05/10→05/11 = 1; 05/10→06/11 = 2).
 */
export function periodsBetween(mode: BillingMode, from: Date, to: Date): number {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (!(b > a)) return 1;
  if (mode === "MENSAL") {
    let m = 1;
    while (m < 1200 && dayNumber(addMonths(from, m)) < b) m++;
    return m;
  }
  return b - a;
}

/** "1 diária", "3 diárias", "1 mês", "2 meses". */
export function periodLabel(mode: BillingMode, n: number): string {
  if (mode === "MENSAL") return n === 1 ? "1 mês" : `${n} meses`;
  return n === 1 ? "1 diária" : `${n} diárias`;
}

/** Preço de tabela do produto na modalidade (null = não definido). */
export function tablePrice(p: { rentalPriceCents: number | null; monthlyPriceCents?: number | null }, mode: BillingMode): number | null {
  return mode === "MENSAL" ? (p.monthlyPriceCents ?? null) : p.rentalPriceCents;
}
