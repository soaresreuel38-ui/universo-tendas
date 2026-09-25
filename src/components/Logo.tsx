export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill="currentColor" className="text-white/10" />
        <path d="M12 44 32 18l20 26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
        <path d="M32 18v26M22 44l10-13 10 13" fill="none" stroke="#d97706" strokeWidth="4" strokeLinejoin="round" />
      </svg>
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-wide">UNIVERSO TENDAS</span>
          <span className="block text-[11px] uppercase tracking-[0.18em] opacity-60">Gestão</span>
        </span>
      )}
    </span>
  );
}
