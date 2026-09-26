/* eslint-disable @next/next/no-img-element */

/** Logo oficial da Universo Tendas (arquivo em public/brand/universo-logo.png). */
export function Logo({ compact = false, size = "md", tone = "dark" }: { compact?: boolean; size?: "md" | "lg"; tone?: "dark" | "light" }) {
  if (size === "lg") {
    return <img src="/brand/universo-logo.png" alt="Universo Locação de Tendas" width={150} height={150} className="h-36 w-36 rounded-2xl" />;
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/brand/universo-logo.png" alt="Universo Locação de Tendas" width={34} height={34} className="h-[34px] w-[34px] shrink-0 rounded-[9px]" />
      {compact ? null : (
        <span className={`leading-none ${tone === "light" ? "text-white" : "text-graphite"}`}>
          <span className="block text-[15px] font-semibold tracking-[-0.01em]">Universo</span>
          <span className={`mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.18em] ${tone === "light" ? "text-white/60" : "text-faint"}`}>Locação de tendas</span>
        </span>
      )}
    </span>
  );
}
