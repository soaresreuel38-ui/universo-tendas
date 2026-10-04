/**
 * Eventos do site (visitas, produto visto, início/abandono/conclusão de reserva).
 * Ainda não há ferramenta de analytics configurada: os eventos vão para window.dataLayer
 * (padrão do Google Tag Manager / GA4) e para um CustomEvent "ut:track". Ao configurar a
 * ferramenta, basta ligá-la aqui — as páginas não precisam mudar. Nenhum dado pessoal é enviado.
 */
export type TrackEvent =
  | "page_view"
  | "product_view"
  | "availability_check"
  | "booking_start"
  | "booking_step"
  | "booking_abandon"
  | "booking_complete"
  | "booking_error"
  | "whatsapp_click"
  | "model3d_open"
  | "cancel_request";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function track(event: TrackEvent, props: Record<string, string | number | boolean | null | undefined> = {}) {
  if (typeof window === "undefined") return;
  try {
    const detail = { event, ...props, source: new URLSearchParams(window.location.search).get("utm_source") ?? undefined };
    (window.dataLayer ??= []).push(detail);
    window.dispatchEvent(new CustomEvent("ut:track", { detail }));
  } catch {
    // analytics nunca pode quebrar o site
  }
}
