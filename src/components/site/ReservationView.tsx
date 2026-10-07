"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { ProductPlaceholder } from "@/components/products/ProductImage";
import { track } from "@/lib/analytics";
import { fmtDate, fmtTime, money, whatsappLink } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/public-urls";
import type { RentalView } from "@/server/public-rental-view";

type Ref = { token: string } | { code: string; phone: string };

const TONE = {
  wait: "bg-amber-100 text-amber-900",
  ok: "bg-emerald-100 text-emerald-900",
  active: "bg-ink-tint text-ink",
  done: "bg-sand text-night",
  canceled: "bg-night/10 text-night/70",
} as const;

/** O que o cliente vê sobre a própria reserva — na confirmação e em "Minha reserva". */
export function ReservationView({ rental, reference, fresh = false }: { rental: RentalView; reference: Ref; fresh?: boolean }) {
  const [view, setView] = useState(rental);
  const start = new Date(view.eventAt);
  const end = new Date(view.eventEndAt);
  const sameDay = fmtDate(start) === fmtDate(end);
  const hasTime = fmtTime(start) !== "00:00";
  const dates = sameDay ? fmtDate(start) : `${fmtDate(start)} → ${fmtDate(end)}`;
  const items = view.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
  const qty = view.items.reduce((s, i) => s + i.quantity, 0);

  const message = [
    `Olá! Sou ${view.customerName}. ${fresh ? "Acabei de solicitar" : "Solicitei"} uma locação pelo site da Universo Tendas.`,
    "",
    `Reserva: #${view.code}`,
    `Tenda: ${items}`,
    `Data: ${dates}`,
    ...(view.address ? [`Local: ${view.address}`] : []),
  ].join("\n");
  const wa = whatsappLink(view.companyWhatsapp, message);

  return (
    <div>
      <div className="text-center">
        {fresh ? <p className="text-[13px] font-medium text-night/50">Reserva recebida</p> : null}
        <h1 className="mt-4 text-[44px] font-semibold leading-none tracking-[-0.03em] tabular md:text-[64px]">#{view.code}</h1>
        <p className={`mx-auto mt-6 inline-flex px-4 py-2 text-[13px] font-medium ${TONE[view.status.tone]}`}>{view.status.label}</p>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-night/65">{view.status.detail}</p>
      </div>

      <div className="mt-10 divide-y divide-night/10 bg-white ring-1 ring-night/10">
        {view.items.map((i) => (
          <div key={i.code} className="flex items-center gap-4 p-4">
            <Link href={i.path} className="h-16 w-20 shrink-0 overflow-hidden">
              {i.photoId ? <img src={publicPhotoUrl(i.photoId, true)} alt="" className="h-full w-full object-cover" /> : <ProductPlaceholder compact />}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-semibold leading-snug tracking-[-0.01em] tracking-[0.01em]">{i.name}</p>
              <p className="text-[13px] text-night/55">
                {i.quantity} {i.quantity === 1 ? "unidade" : "unidades"}
                {i.unitPriceCents != null ? ` · ${money(i.unitPriceCents)} por unidade${view.days ? ` (${view.days} ${view.days === 1 ? "diária" : "diárias"})` : ""}` : " · Valor a consultar"}
              </p>
            </div>
          </div>
        ))}
        <Line label="Data">
          {dates}
          {hasTime ? <span className="text-night/55"> · {fmtTime(start)} às {fmtTime(end)}</span> : null}
        </Line>
        {view.address ? <Line label="Local">{view.address}{view.eventNotes ? <span className="block text-night/55">Obs.: {view.eventNotes}</span> : null}</Line> : null}
        <Line label="Quantidade">{qty} {qty === 1 ? "unidade" : "unidades"}</Line>
        <Line label="Contrato">{view.contract ? `#${view.contract.number} · ${view.contract.status}` : "Será enviado pela equipe após a confirmação."}</Line>
        <Line label="Pagamento">
          {view.pricePending ? "Valor a consultar" : view.totalCents > 0 ? `${money(view.paidCents)} pago de ${money(view.totalCents)}` : "A combinar com a equipe"}
        </Line>
        <div className="flex items-baseline justify-between px-5 py-5">
          <span className="text-[13px] font-medium text-night/55">Total</span>
          <span className="text-[24px] font-semibold tracking-[-0.01em]">{view.pricePending ? "Valor a consultar" : money(view.totalCents)}</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("whatsapp_click", { from: "reserva" })}
            className="inline-flex h-14 flex-1 items-center justify-center bg-ink px-6 text-[15px] font-medium text-white hover:bg-ink-deep"
          >
            Falar pelo WhatsApp
          </a>
        ) : null}
        <Link href="/tendas" className="inline-flex h-14 flex-1 items-center justify-center border border-night/20 px-6 text-[15px] font-medium hover:border-night">
          Ver outras tendas
        </Link>
      </div>
      {wa ? <p className="mt-2 text-center text-[12px] text-night/45">A mensagem abre pronta no WhatsApp. Nada é enviado sem você tocar em enviar.</p> : null}

      {view.canRequestCancel ? <CancelRequest reference={reference} onDone={() => setView((v) => ({ ...v, canRequestCancel: false, status: { label: "Cancelamento solicitado", tone: "wait", detail: "Recebemos seu pedido de cancelamento. A equipe vai analisar e retornar." } }))} /> : null}
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-4">
      <span className="w-24 shrink-0 pt-0.5 text-[13px] font-medium text-night/45">{label}</span>
      <span className="min-w-0 flex-1 text-[15px] leading-relaxed">{children}</span>
    </div>
  );
}

/** O cliente só PEDE o cancelamento; a empresa decide no painel (e só então o estoque é liberado). */
function CancelRequest({ reference, onDone }: { reference: Ref; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<{ sending: boolean; error: string | null }>({ sending: false, error: null });

  async function send() {
    setState({ sending: true, error: null });
    try {
      const res = await fetch("/api/public/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reference, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar agora.");
      track("cancel_request");
      onDone();
    } catch (e) {
      setState({ sending: false, error: e instanceof Error ? e.message : "Não foi possível enviar agora." });
    }
  }

  return (
    <div className="mt-12 border-t border-night/10 pt-8">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mx-auto block text-[14px] font-medium text-night/55 underline-offset-4 hover:text-night hover:underline">
          Solicitar cancelamento
        </button>
      ) : (
        <div className="bg-white p-5 ring-1 ring-night/10">
          <p className="text-[18px] font-semibold tracking-[0.02em]">Solicitar cancelamento</p>
          <p className="mt-2 text-[14px] leading-relaxed text-night/65">
            Seu pedido será enviado para a equipe da Universo Tendas, que vai analisar e responder. A reserva só é cancelada depois dessa análise.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Motivo (opcional)"
            className="mt-4 w-full border border-night/15 px-3.5 py-3 text-[16px] outline-none transition-colors focus:border-night"
          />
          {state.error ? <p className="mt-2 text-[14px] text-accent">{state.error}</p> : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={send} disabled={state.sending} className="h-12 flex-1 bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-60">
              {state.sending ? "Enviando…" : "Enviar pedido de cancelamento"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-12 flex-1 border border-night/20 px-5 text-[14px] font-medium">
              Manter reserva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
