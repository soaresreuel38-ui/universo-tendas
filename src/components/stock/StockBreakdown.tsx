/** Barra proporcional + números. "reserved" deve ser a parte reservada que está no depósito. */
export function StockBreakdown({
  free,
  reserved,
  rented,
  maintenance,
  pending,
  unit,
}: {
  free: number;
  reserved: number;
  rented: number;
  maintenance: number;
  pending: number;
  unit: string;
}) {
  const parts = [
    { label: "Disponível", value: free, color: "bg-emerald-500" },
    { label: "Reservado", value: reserved, color: "bg-sky-500" },
    { label: "Alugado", value: rented, color: "bg-amber-500" },
    { label: "Manutenção", value: maintenance, color: "bg-yellow-400" },
    { label: "Pendente", value: pending, color: "bg-red-500" },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label="Distribuição do estoque">
        {total > 0 ? parts.map((p) => (p.value > 0 ? <span key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} /> : null)) : null}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className={`h-2 w-2 rounded-full ${p.color}`} />
              {p.label}
            </dt>
            <dd className="tabular text-xl font-semibold text-zinc-900">{p.value}</dd>
          </div>
        ))}
        <div>
          <dt className="text-xs text-zinc-500">Total</dt>
          <dd className="tabular text-xl font-semibold text-zinc-900">
            {total} <span className="text-sm font-normal text-zinc-400">{unit}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
