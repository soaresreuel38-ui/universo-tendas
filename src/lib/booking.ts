import type { RentalStatus } from "./domain";
import { addDays, DATE_KEY_RE, startOfDay, TIME_KEY_RE, TZ, todayKey, zonedToUtc } from "./time";

/**
 * Período operacional bloqueado por uma reserva do site.
 *
 * Evento de 10/10 a 12/10 com margem de 1 dia antes e 1 depois:
 * estoque ocupado de 09/10 00:00 até 14/10 00:00 (exclusivo), ou seja, 09/10 a 13/10 inteiros.
 * departureAt/expectedReturnAt são os mesmos campos que o painel usa — a regra de
 * disponibilidade (availabilityForPeriod) não muda.
 */
export function bookingWindow(eventStartKey: string, eventEndKey: string, daysBefore: number, daysAfter: number) {
  return {
    departureAt: startOfDay(addDays(eventStartKey, -daysBefore)),
    expectedReturnAt: startOfDay(addDays(eventEndKey, daysAfter + 1)),
  };
}

/** Início e fim do evento em si (horários opcionais; sem horário = dia inteiro). */
export function eventMoments(eventStartKey: string, eventEndKey: string, startTime?: string | null, endTime?: string | null) {
  return {
    eventAt: zonedToUtc(eventStartKey, startTime || "00:00", TZ),
    eventEndAt: zonedToUtc(eventEndKey, endTime || "23:59", TZ),
  };
}

export const MAX_EVENT_DAYS = 60;
export const MAX_DAYS_AHEAD = 730;

/** Valida as datas informadas pelo cliente. Retorna a mensagem de erro, ou null se estiver tudo certo. */
export function checkEventDates(
  start: string,
  end: string,
  opts: { startTime?: string | null; endTime?: string | null; now?: Date } = {},
): string | null {
  if (!DATE_KEY_RE.test(start)) return "Informe a data de início do evento.";
  if (!DATE_KEY_RE.test(end)) return "Informe a data de término do evento.";
  if (end < start) return "A data de término precisa ser igual ou depois do início.";
  const today = todayKey(opts.now);
  if (start < today) return "A data de início já passou.";
  if (start > addDays(today, MAX_DAYS_AHEAD)) return "Para datas tão distantes, fale com a gente pelo WhatsApp.";
  if (end > addDays(start, MAX_EVENT_DAYS - 1)) return `O evento pode ter no máximo ${MAX_EVENT_DAYS} dias. Para mais, fale com a gente.`;
  if (opts.startTime && !TIME_KEY_RE.test(opts.startTime)) return "Horário de início inválido.";
  if (opts.endTime && !TIME_KEY_RE.test(opts.endTime)) return "Horário de término inválido.";
  if (start === end && opts.startTime && opts.endTime && opts.endTime <= opts.startTime) {
    return "O horário de término precisa ser depois do início.";
  }
  return null;
}

/** Como o cliente enxerga a situação da reserva (sem jargão interno). */
export function publicStatus(r: { status: RentalStatus; cancelRequestedAt?: Date | null }): {
  label: string;
  tone: "wait" | "ok" | "active" | "done" | "canceled";
  detail: string;
} {
  if (r.status === "CANCELADA") return { label: "Cancelada", tone: "canceled", detail: "Esta reserva foi cancelada." };
  if (r.cancelRequestedAt) {
    return { label: "Cancelamento solicitado", tone: "wait", detail: "Recebemos seu pedido de cancelamento. A equipe vai analisar e retornar." };
  }
  switch (r.status) {
    case "ORCAMENTO":
    case "RESERVADA":
      return { label: "Reservada · aguardando aprovação", tone: "wait", detail: "As unidades estão separadas para as suas datas enquanto a equipe confirma o pedido." };
    case "CONFIRMADA":
    case "SEPARACAO":
      return { label: "Confirmada", tone: "ok", detail: "Sua locação está confirmada." };
    case "SAIU":
    case "EM_EVENTO":
    case "AGUARDANDO_RETORNO":
    case "ATRASADA":
      return { label: "Em andamento", tone: "active", detail: "As estruturas já saíram para o seu evento." };
    default:
      return { label: "Concluída", tone: "done", detail: "Locação concluída. Obrigado!" };
  }
}

/** O cliente pode pedir cancelamento enquanto nada saiu do depósito. */
export const canRequestCancel = (status: RentalStatus) => ["ORCAMENTO", "RESERVADA", "CONFIRMADA", "SEPARACAO"].includes(status);

/**
 * Diárias cobradas numa reserva do site: os dias do evento (10/10 a 12/10 = 3 diárias).
 * A margem operacional (montagem/retirada) bloqueia estoque, mas não entra no valor.
 * O valor por unidade segue a regra do painel (lib/billing): preço da diária × diárias.
 */
export function eventDays(eventStartKey: string, eventEndKey: string): number {
  const [a, b] = [eventStartKey, eventEndKey].map((k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)));
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}
