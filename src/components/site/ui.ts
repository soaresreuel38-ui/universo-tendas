/**
 * Linguagem visual do site público (a mesma da página inicial):
 * títulos em caixa alta, cantos retos, azul-noite + grafite + neutros, a fotografia em primeiro plano.
 */
export const ui = {
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.3em]",
  h1: "text-[34px] font-semibold uppercase leading-[1.02] tracking-[-0.02em] sm:text-[48px] lg:text-[64px]",
  h2: "text-[26px] font-semibold uppercase leading-[1.05] tracking-[-0.015em] sm:text-[34px]",
  label: "text-[11px] font-semibold uppercase tracking-[0.18em] text-night/55",
  btnPrimary:
    "inline-flex h-14 items-center justify-center gap-3 bg-night px-8 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-night-soft disabled:opacity-50",
  btnOutline:
    "inline-flex h-14 items-center justify-center gap-3 border border-night/25 px-8 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-night transition-colors hover:border-night disabled:opacity-50",
  btnLight:
    "inline-flex h-14 items-center justify-center gap-3 bg-white px-8 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-night transition-colors hover:bg-linen",
  btnSmall:
    "inline-flex h-11 items-center justify-center gap-2 bg-night px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-night-soft",
  link: "inline-flex items-center gap-3 border-b border-night pb-1 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-night",
  input:
    "mt-2 h-12 w-full border border-night/20 bg-white px-3.5 text-[16px] text-night outline-none transition-colors focus:border-night",
  panel: "border border-night/12 bg-white",
} as const;
