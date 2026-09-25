import { TZ } from "./time";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" });
const longDateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "long", year: "numeric" });

export const money = (cents: number | null | undefined) => (cents == null ? "—" : brl.format(cents / 100));
export const fmtDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—");
export const fmtShortDate = (d: Date | null | undefined) => (d ? shortDateFmt.format(d) : "—");
export const fmtDateTime = (d: Date | null | undefined) => (d ? dateTimeFmt.format(d) : "—");
export const fmtTime = (d: Date | null | undefined) => (d ? timeFmt.format(d) : "—");
export const fmtWeekday = (d: Date) => weekdayFmt.format(d);
export const fmtLongDate = (d: Date) => longDateFmt.format(d);

/** Número da locação/venda com zeros à esquerda: 123 → "000123". */
export const seq = (n: number) => String(n).padStart(6, "0");

/** Converte "1.234,56" / "1234.56" / "1234" em centavos. Retorna null se vazio ou inválido. */
export function parseMoney(value: string | null | undefined): number | null {
  if (value == null) return null;
  let v = value.trim().replace(/^R\$\s*/i, "");
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

/** Centavos para o valor de um campo de formulário ("1234,50"). */
export const moneyInput = (cents: number | null | undefined) =>
  cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");

export const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Link wa.me: aceita número com ou sem 55. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  let digits = onlyDigits(phone);
  if (digits.length < 10) return null;
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
