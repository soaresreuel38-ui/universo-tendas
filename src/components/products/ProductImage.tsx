/* eslint-disable @next/next/no-img-element */

/**
 * Foto real do produto. Nunca distorce (object-fit), carrega sob demanda e usa a miniatura em listas.
 * Sem foto: desenho técnico neutro com o aviso de que a foto ainda será cadastrada — nunca uma imagem genérica.
 */
export function ProductImage({
  photoId,
  name,
  size = "thumb",
  fit = "cover",
  className = "",
  priority = false,
}: {
  photoId: string | null | undefined;
  name: string;
  size?: "thumb" | "full";
  fit?: "cover" | "contain";
  className?: string;
  priority?: boolean;
}) {
  if (!photoId) return <ProductPlaceholder name={name} className={className} />;
  return (
    <img
      src={`/api/fotos/${photoId}${size === "thumb" ? "?s=t" : ""}`}
      alt={name}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`h-full w-full bg-[#ebe8e2] ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`}
    />
  );
}

export function ProductPlaceholder({ name, className = "", compact = false }: { name?: string; className?: string; compact?: boolean }) {
  return (
    <div className={`@container relative flex h-full w-full items-center justify-center overflow-hidden bg-[#efece6] ${className}`} role="img" aria-label={name ? `${name} — foto a cadastrar` : "Foto a cadastrar"}>
      {/* malha de prancha técnica */}
      <svg className="absolute inset-0 h-full w-full text-[#e2ded6]" aria-hidden>
        <defs>
          <pattern id="ut-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0v24" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ut-grid)" />
      </svg>
      <div className="relative flex flex-col items-center gap-2 text-[#a39d92]">
        <svg viewBox="0 0 120 70" className={compact ? "h-6 w-10" : "h-auto w-[55%] max-w-24 @[180px]:w-24"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
          <path d="M8 62 60 10l52 52M60 10v52M34 62l26-26 26 26M8 62h104" />
          <path d="M60 10V4" strokeLinecap="round" />
        </svg>
        {compact ? null : <span className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] @[180px]:block">Foto a cadastrar</span>}
      </div>
    </div>
  );
}
