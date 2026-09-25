/**
 * Utilitários de data/hora com fuso explícito (sem dependências externas).
 * Datas "de calendário" circulam como strings "YYYY-MM-DD" e horários como "HH:MM".
 */

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converte data + hora locais (no fuso informado) para um instante UTC. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const first = naive - offsetMs(new Date(naive), timeZone);
  // Segunda passada cobre transições de horário de verão.
  const second = naive - offsetMs(new Date(first), timeZone);
  return new Date(second);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toTimeKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export const DATE_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_KEY_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ───────────────────────── Universo Tendas ─────────────────────────

/** Sinop - MT (sem horário de verão, UTC-4). */
export const TZ = "America/Cuiaba";

/** Converte o valor de um <input type="datetime-local"> (horário de Sinop) para UTC. */
export function fromLocalInput(value: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  if (!m || !DATE_KEY_RE.test(m[1]) || !TIME_KEY_RE.test(m[2])) return null;
  return zonedToUtc(m[1], m[2], TZ);
}

/** Valor para <input type="datetime-local"> no horário de Sinop. */
export function toLocalInput(date: Date | null | undefined): string {
  if (!date) return "";
  return `${toDateKey(date, TZ)}T${toTimeKey(date, TZ)}`;
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now, TZ);
}

/** Início (00:00) de um dia de calendário em Sinop. */
export function startOfDay(dateKey: string): Date {
  return zonedToUtc(dateKey, "00:00", TZ);
}

/** Intervalo [início, fim) do dia informado em Sinop. */
export function dayRange(dateKey: string): { start: Date; end: Date } {
  return { start: startOfDay(dateKey), end: startOfDay(addDays(dateKey, 1)) };
}

/** Segunda-feira da semana do dia informado. */
export function startOfWeekKey(dateKey: string): string {
  const wd = weekdayOf(dateKey);
  return addDays(dateKey, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function addMonths(dateKey: string, months: number): string {
  const [y, m] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
