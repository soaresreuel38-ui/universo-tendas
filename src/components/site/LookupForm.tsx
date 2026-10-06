"use client";

import { useState } from "react";
import type { RentalView } from "@/server/public-rental-view";
import { ReservationView } from "./ReservationView";

/** Consulta por número + telefone. Enviado por POST (o telefone não vai para a URL). */
export function LookupForm() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<{ loading: boolean; error: string | null; rental: RentalView | null }>({ loading: false, error: null, rental: null });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ loading: true, error: null, rental: null });
    try {
      const res = await fetch("/api/public/reservations/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível consultar agora.");
      setState({ loading: false, error: null, rental: data.rental });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : "Não foi possível consultar agora.", rental: null });
    }
  }

  if (state.rental) {
    return (
      <div>
        <ReservationView rental={state.rental} reference={{ code, phone }} />
        <button type="button" onClick={() => setState({ loading: false, error: null, rental: null })} className="mx-auto mt-8 block text-[13px] text-night/55 underline underline-offset-4">
          Consultar outra reserva
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night/55">Número da reserva</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          inputMode="numeric"
          maxLength={10}
          placeholder="000123"
          className="mt-2 h-12 w-full border border-night/20 bg-white px-3.5 text-[16px] outline-none transition-colors focus:border-night"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night/55">Telefone / WhatsApp informado no pedido</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={20}
          placeholder="(66) 90000-0000"
          className="mt-2 h-12 w-full border border-night/20 bg-white px-3.5 text-[16px] outline-none transition-colors focus:border-night"
        />
      </label>
      {state.error ? <p role="alert" className="mt-4 bg-accent-soft px-4 py-3 text-[14px] text-accent">{state.error}</p> : null}
      <button disabled={state.loading} className="mt-6 h-14 w-full bg-night text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-night-soft disabled:opacity-60">
        {state.loading ? "Consultando…" : "Consultar"}
      </button>
    </form>
  );
}
