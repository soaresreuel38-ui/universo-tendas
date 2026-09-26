/* eslint-disable @next/next/no-img-element */

/** Logo oficial da Universo Tendas (arquivo em public/brand/universo-logo.png). */
export function Logo({ compact = false, size = "md" }: { compact?: boolean; size?: "md" | "lg" }) {
  if (size === "lg") {
    return <img src="/brand/universo-logo.png" alt="Universo Locação de Tendas" width={150} height={150} className="h-36 w-36 rounded-xl" />;
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/brand/universo-logo.png" alt="Universo Locação de Tendas" width={36} height={36} className="h-9 w-9 shrink-0 rounded-md ring-1 ring-white/20" />
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-sm font-extrabold tracking-wide">UNIVERSO</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">Locação de Tendas</span>
        </span>
      )}
    </span>
  );
}
