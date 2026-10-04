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

/**
 * Quantas diárias ou meses cabem no período (sempre ao menos 1).
 * Diária: cada 24 h iniciadas conta uma diária. Mensal: cada mês de calendário iniciado conta um mês.
 */
export function periodsBetween(mode: BillingMode, from: Date, to: Date): number {
  if (!(to.getTime() > from.getTime())) return 1;
  if (mode === "MENSAL") {
    let m = 1;
    while (m < 1200 && addMonths(from, m).getTime() < to.getTime()) m++;
    return m;
  }
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY - 1e-9));
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
