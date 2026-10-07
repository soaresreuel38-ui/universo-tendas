"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { ui } from "./ui";

/** Consulta rápida na página do produto. O número vem do servidor (mesma regra do painel). */
export function AvailabilityCheck({ productId, slug, unit }: { productId: string; slug: string; unit: string }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [state, setState] = useState<{ loading: boolean; free: number | null; error: string | null }>({ loading: false, free: null, error: null });

  async function check(s: string, e: string) {
    if (!s || !e) return;
    setState({ loading: true, free: null, error: null });
    try {
      const res = await fetch(`/api/public/availability?ids=${productId}&inicio=${s}&fim=${e}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível consultar agora.");
      setState({ loading: false, free: data.free[productId] ?? 0, error: null });
      track("availability_check", { product: slug, free: data.free[productId] ?? 0 });
    } catch (err) {
      setState({ loading: false, free: null, error: err instanceof Error ? err.message : "Não foi possível consultar agora." });
    }
  }

  return (
    <div className={`${ui.panel} p-5 sm:p-7`}>
      <h2 className={ui.h3}>Disponibilidade e orçamento</h2>
      <p className="mt-1.5 text-[14.5px] text-night/60">Informe as datas do evento para ver quantas unidades estão livres.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className={ui.label}>Início do evento</span>
          <input
            type="date"
            value={start}
            onChange={(ev) => {
              setStart(ev.target.value);
              const e = end && end >= ev.target.value ? end : ev.target.value;
              setEnd(e);
              check(ev.target.value, e);
            }}
            className={ui.input}
          />
        </label>
        <label className="block">
          <span className={ui.label}>Término</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(ev) => {
              setEnd(ev.target.value);
              check(start, ev.target.value);
            }}
            className={ui.input}
          />
        </label>
      </div>
      <div className="mt-4 min-h-6 text-[15px]" aria-live="polite">
        {state.loading ? <span className="text-night/55">Consultando…</span> : null}
        {state.error ? <span className="text-accent">{state.error}</span> : null}
        {state.free != null ? (
          state.free > 0 ? (
            <span>
              <b className="text-[20px] font-semibold">{state.free}</b> {state.free === 1 ? unit : unit === "un" ? "unidades" : unit} disponíveis para o período.
            </span>
          ) : (
            <span className="text-accent">Não há estoque suficiente para o período selecionado.</span>
          )
        ) : null}
      </div>
      <Link
        href={`/reservar?tenda=${slug}${start && end ? `&inicio=${start}&fim=${end}` : ""}`}
        aria-disabled={state.free === 0}
        className={`mt-5 flex h-12 items-center justify-center text-[15px] font-medium transition-colors ${
          state.free === 0 ? "pointer-events-none bg-night/20 text-night/50" : "bg-ink text-white hover:bg-ink-deep"
        }`}
      >
        Solicitar orçamento
      </Link>
    </div>
  );
}
