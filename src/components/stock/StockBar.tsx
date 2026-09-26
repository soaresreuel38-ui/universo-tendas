import { StatusDot } from "@/components/ui/primitives";

export type StockParts = { free: number; reserved: number; rented: number; maintenance: number };

const SEGMENTS: Array<{ key: keyof StockParts; label: string; color: string; tone: "ok" | "info" | "accent" | "muted" }> = [
  { key: "free", label: "Disponível", color: "bg-st-free", tone: "ok" },
  { key: "reserved", label: "Reservado", color: "bg-st-reserved", tone: "info" },
  { key: "rented", label: "Em locação", color: "bg-st-rented", tone: "accent" },
  { key: "maintenance", label: "Manutenção", color: "bg-st-maint", tone: "muted" },
];

/** Barra segmentada: mostra de relance como o estoque de um produto está distribuído. */
export function StockBar({ parts, className = "", thin = false }: { parts: StockParts; className?: string; thin?: boolean }) {
  const total = SEGMENTS.reduce((s, x) => s + Math.max(0, parts[x.key]), 0);
  return (
    <div
      className={`flex w-full gap-px overflow-hidden rounded-full bg-line ${thin ? "h-1.5" : "h-2"} ${className}`}
      role="img"
      aria-label={SEGMENTS.map((x) => `${x.label}: ${parts[x.key]}`).join(", ")}
    >
      {total === 0
        ? null
        : SEGMENTS.filter((x) => parts[x.key] > 0).map((x) => (
            <span key={x.key} className={`${x.color} h-full transition-[width] duration-500`} style={{ width: `${(parts[x.key] / total) * 100}%` }} />
          ))}
    </div>
  );
}

export function StockLegend({ parts, total }: { parts: StockParts; total?: number }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
      {SEGMENTS.map((x) => (
        <div key={x.key}>
          <dt className="eyebrow flex items-center gap-1.5">
            <StatusDot tone={x.tone} className={x.key === "maintenance" ? "!bg-st-maint" : ""} />
            {x.label}
          </dt>
          <dd className="tabular mt-1 text-xl font-semibold tracking-tight text-graphite">{parts[x.key]}</dd>
        </div>
      ))}
      {total != null ? (
        <div>
          <dt className="eyebrow">Total</dt>
          <dd className="tabular mt-1 text-xl font-semibold tracking-tight text-graphite">{total}</dd>
        </div>
      ) : null}
    </dl>
  );
}
