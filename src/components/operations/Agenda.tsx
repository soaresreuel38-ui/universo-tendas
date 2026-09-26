import Link from "next/link";
import { ProductImage } from "@/components/products/ProductImage";
import { Icon, type IconName } from "@/components/ui/icons";
import { fmtDate, fmtTime, seq } from "@/lib/format";
import { dayRange, todayKey } from "@/lib/time";
import type { RentalListRow } from "@/server/queries";

export type AgendaKind = "saida" | "montagem" | "evento" | "desmontagem" | "retorno" | "conferencia";

export const AGENDA_KIND: Record<AgendaKind, { label: string; icon: IconName; dot: string; text: string }> = {
  saida: { label: "Saída", icon: "truck", dot: "bg-st-reserved", text: "text-[#244f8a]" },
  montagem: { label: "Montagem", icon: "tent", dot: "bg-ink", text: "text-ink" },
  evento: { label: "Evento", icon: "sparkle", dot: "bg-graphite", text: "text-graphite" },
  desmontagem: { label: "Desmontagem", icon: "layers", dot: "bg-st-maint", text: "text-[#5f554c]" },
  retorno: { label: "Devolução", icon: "undo", dot: "bg-st-rented", text: "text-[#8a5413]" },
  conferencia: { label: "Conferência", icon: "clipboard", dot: "bg-st-rented", text: "text-[#8a5413]" },
};

export type AgendaEntry = { key: string; kind: AgendaKind; at: Date | null; late: boolean; rental: RentalListRow };

type Ops = {
  departures: RentalListRow[];
  returns: RentalListRow[];
  setups: RentalListRow[];
  teardowns: RentalListRow[];
  events: RentalListRow[];
  overdue: RentalListRow[];
  awaitingCheck: RentalListRow[];
};

/** Junta tudo o que acontece hoje em uma linha do tempo única (pendências atrasadas primeiro). */
export function buildAgenda(ops: Ops, now = new Date()): AgendaEntry[] {
  const { start } = dayRange(todayKey(now));
  const list: AgendaEntry[] = [
    ...ops.departures.map((r) => ({ key: `s-${r.id}`, kind: "saida" as const, at: r.departureAt, late: r.departureAt < start, rental: r })),
    ...ops.setups.map((r) => ({ key: `m-${r.id}`, kind: "montagem" as const, at: r.setupAt, late: false, rental: r })),
    ...ops.events.map((r) => ({ key: `e-${r.id}`, kind: "evento" as const, at: r.eventAt, late: false, rental: r })),
    ...ops.teardowns.map((r) => ({ key: `d-${r.id}`, kind: "desmontagem" as const, at: r.teardownAt, late: false, rental: r })),
    ...ops.returns.map((r) => ({ key: `r-${r.id}`, kind: "retorno" as const, at: r.expectedReturnAt, late: false, rental: r })),
    ...ops.overdue.map((r) => ({ key: `a-${r.id}`, kind: "retorno" as const, at: r.expectedReturnAt, late: true, rental: r })),
    ...ops.awaitingCheck.map((r) => ({ key: `c-${r.id}`, kind: "conferencia" as const, at: r.actualReturnAt ?? r.expectedReturnAt, late: false, rental: r })),
  ];
  return list.sort((a, b) => Number(b.late) - Number(a.late) || (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
}

function actionFor(e: AgendaEntry): { label: string; href: string } {
  const id = e.rental.id;
  if (e.kind === "saida") return { label: "Registrar saída", href: `/admin/locacoes/${id}/saida` };
  if (e.kind === "retorno" || e.kind === "conferencia") return { label: "Conferir", href: `/admin/locacoes/${id}/conferencia` };
  return { label: "Abrir", href: `/admin/locacoes/${id}` };
}

export function AgendaTimeline({ entries, empty = "Nada agendado para hoje.", compact = false }: { entries: AgendaEntry[]; empty?: string; compact?: boolean }) {
  if (!entries.length) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-faint">
          <Icon name="sun" className="h-5 w-5" />
        </span>
        <p className="text-sm text-muted">{empty}</p>
      </div>
    );
  }
  const today = todayKey();
  return (
    <ol className="relative">
      {entries.map((e, i) => {
        const k = AGENDA_KIND[e.kind];
        const a = actionFor(e);
        const r = e.rental;
        const photos = r.items.map((it) => it.product).filter((p, j, arr) => arr.findIndex((x) => x.id === p.id) === j);
        const otherDay = e.at && todayKey(e.at) !== today;
        return (
          <li key={e.key} className="group relative grid grid-cols-[56px_20px_1fr] gap-x-2 sm:grid-cols-[64px_24px_1fr_auto] sm:gap-x-3" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            {/* horário */}
            <div className="pt-4 text-right">
              <span className={`tabular font-mono text-[13px] font-medium ${e.late ? "text-accent" : "text-graphite"}`}>{e.at ? fmtTime(e.at) : "—"}</span>
              {otherDay && e.at ? <span className="block text-[10.5px] text-faint">{fmtDate(e.at).slice(0, 5)}</span> : null}
            </div>
            {/* trilho */}
            <div className="relative flex justify-center">
              <span className={`absolute inset-y-0 w-px bg-line ${i === 0 ? "top-5" : ""} ${i === entries.length - 1 ? "bottom-auto h-5" : ""}`} aria-hidden />
              <span className={`relative mt-[18px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${e.late ? "bg-accent" : k.dot}`} aria-hidden />
            </div>
            {/* conteúdo */}
            <Link href={`/admin/locacoes/${r.id}`} className={`min-w-0 border-b border-line/70 py-3.5 ${i === entries.length - 1 ? "border-b-0" : ""}`}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${e.late ? "text-accent" : k.text}`}>
                  {e.late ? (e.kind === "saida" ? "Saída atrasada" : "Atrasado") : k.label}
                </span>
                <span className="font-mono text-[11px] text-faint">#{seq(r.number)}</span>
              </p>
              <p className="mt-0.5 truncate text-[15px] font-medium text-graphite group-hover:text-ink">
                {r.customer.name} <span className="font-normal text-muted">— {r.eventName}</span>
              </p>
              {compact ? null : (
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex -space-x-2">
                    {photos.slice(0, 4).map((p) => (
                      <span key={p.id} className="h-7 w-7 overflow-hidden rounded-md border-2 border-white bg-canvas">
                        <ProductImage photoId={p.photoId} name={p.name} />
                      </span>
                    ))}
                  </span>
                  <span className="truncate text-xs text-faint">{r.items.map((it) => `${it.quantity} ${it.product.name}`).join(" · ")}</span>
                </div>
              )}
            </Link>
            <div className="col-span-3 col-start-3 -mt-1 pb-3 sm:col-span-1 sm:col-start-4 sm:mt-0 sm:flex sm:items-center sm:pb-0 sm:pl-2">
              {e.kind === "saida" || e.kind === "retorno" || e.kind === "conferencia" ? (
                <Link
                  href={a.href}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors ${
                    e.late ? "bg-accent text-white hover:bg-accent-strong" : "border border-line-strong bg-white text-graphite hover:bg-paper"
                  }`}
                >
                  {a.label}
                  <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
