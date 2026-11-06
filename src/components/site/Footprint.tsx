/** Medidas (em metros) lidas do próprio cadastro: campo "dimensões" ou o nome ("TENDA 10X10"). */
export function parseDimensions(...sources: (string | null | undefined)[]) {
  for (const s of sources) {
    const m = s?.match(/(\d+(?:[.,]\d+)?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)/);
    if (m) {
      const w = Number(m[1].replace(",", "."));
      const d = Number(m[2].replace(",", "."));
      if (w > 0 && d > 0) return { w, d, area: Math.round(w * d * 100) / 100 };
    }
  }
  return null;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Planta da cobertura desenhada em escala: todas as tendas da lista usam a mesma escala
 * (`maxSide` metros = largura total do desenho), então a diferença de tamanho é real.
 */
export function Footprint({ w, d, maxSide, className = "" }: { w: number; d: number; maxSide: number; className?: string }) {
  const S = 88; // px do lado maior possível
  const pw = Math.max(6, (w / maxSide) * S);
  const pd = Math.max(6, (d / maxSide) * S);
  const x = (S - pw) / 2 + 6;
  const y = (S - pd) / 2 + 6;
  return (
    <svg viewBox={`0 0 ${S + 12} ${S + 12}`} className={className} aria-hidden>
      {/* quadro da escala (lado maior da lista) */}
      <rect x="6" y="6" width={S} height={S} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeDasharray="2 3" />
      <rect x={x} y={y} width={pw} height={pd} fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.4" className="text-brand" />
      <path d={`M${x} ${y}L${x + pw} ${y + pd}M${x + pw} ${y}L${x} ${y + pd}`} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" className="text-brand" />
    </svg>
  );
}

export function areaLabel(area: number) {
  return `${fmt(area)} m²`;
}
