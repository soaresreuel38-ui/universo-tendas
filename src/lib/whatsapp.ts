import { fmtDateTime, seq, whatsappLink } from "./format";

/** Mensagem de confirmação da locação. Só é enviada se o usuário clicar e confirmar no WhatsApp. */
export function rentalWhatsappMessage(r: {
  number: number;
  eventName: string;
  eventAt: Date | null;
  departureAt: Date;
  expectedReturnAt: Date;
  eventAddress: string | null;
  customer: { name: string };
  items: Array<{ quantity: number; product: { name: string; unit: string } }>;
  footer: string;
}) {
  const products = r.items.map((i) => `• ${i.quantity} ${i.product.unit} — ${i.product.name}`).join("\n");
  return [
    `Olá, ${r.customer.name}!`,
    "",
    `Sua locação #${seq(r.number)} foi registrada.`,
    "",
    `Evento: ${r.eventName}`,
    `Data: ${fmtDateTime(r.eventAt ?? r.departureAt)}`,
    ...(r.eventAddress ? [`Local: ${r.eventAddress}`] : []),
    "",
    "Produtos:",
    products,
    "",
    `Retirada: ${fmtDateTime(r.departureAt)}`,
    `Retorno previsto: ${fmtDateTime(r.expectedReturnAt)}`,
    "",
    r.footer,
  ].join("\n");
}

export function rentalWhatsappLink(phone: string | null | undefined, message: string) {
  return whatsappLink(phone, message);
}
