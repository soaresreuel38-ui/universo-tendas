/**
 * Linguagem visual do site público: branco, cinza e grafite; o azul da marca (ink) só em
 * navegação, botões e itens selecionados. Títulos em frase normal, fotografia em primeiro plano.
 */
export const ui = {
  /** Informação auxiliar pequena (categoria, local, rótulo de seção). */
  meta: "text-[13px] text-night/55",
  label: "text-[13px] font-medium text-night/70",
  h1: "text-[34px] font-semibold leading-[1.08] tracking-[-0.025em] text-night sm:text-[46px] lg:text-[56px]",
  h2: "text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-night sm:text-[32px]",
  h3: "text-[19px] font-semibold leading-snug tracking-[-0.01em] text-night",
  lead: "text-[17px] leading-relaxed text-night/70 sm:text-[18px]",
  btnPrimary:
    "inline-flex h-12 items-center justify-center gap-2 bg-ink px-6 text-[15px] font-medium text-white transition-colors hover:bg-ink-deep disabled:opacity-50",
  btnOutline:
    "inline-flex h-12 items-center justify-center gap-2 border border-night/20 bg-white px-6 text-[15px] font-medium text-night transition-colors hover:border-night/50 disabled:opacity-50",
  btnSmall:
    "inline-flex h-10 items-center justify-center gap-2 bg-ink px-4 text-[14px] font-medium text-white transition-colors hover:bg-ink-deep",
  link: "inline-flex items-center gap-1.5 text-[15px] font-medium text-ink underline decoration-ink/30 underline-offset-[5px] transition-colors hover:decoration-ink",
  input:
    "mt-1.5 h-12 w-full border border-night/20 bg-white px-3.5 text-[16px] text-night outline-none transition-colors focus:border-ink",
  panel: "border border-night/12 bg-white",
} as const;
