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
        <span className="text-[13px] font-medium text-night/65">Número da reserva</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          inputMode="numeric"
          maxLength={10}
          placeholder="000123"
          className="mt-1.5 h-12 w-full rounded-lg border border-night/15 bg-white px-3.5 text-[16px] outline-none focus:border-night focus:ring-2 focus:ring-night/10"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-[13px] font-medium text-night/65">Telefone / WhatsApp informado no pedido</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={20}
          placeholder="(66) 90000-0000"
          className="mt-1.5 h-12 w-full rounded-lg border border-night/15 bg-white px-3.5 text-[16px] outline-none focus:border-night focus:ring-2 focus:ring-night/10"
        />
      </label>
      {state.error ? <p role="alert" className="mt-4 rounded-[4px] bg-accent-soft px-4 py-3 text-[14px] text-accent">{state.error}</p> : null}
      <button disabled={state.loading} className="mt-6 h-14 w-full rounded-full bg-night text-[13px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-night-soft disabled:opacity-60">
        {state.loading ? "Consultando…" : "Consultar"}
      </button>
    </form>
  );
}
