/**
 * Linguagem visual do site público: preto e grafite, branco para contraste e o azul da logo
 * (brand) como destaque — em linhas finas, rótulos, itens selecionados e no botão principal.
 * Fotografia em primeiro plano, cantos retos, poucas cores.
 */
export const ui = {
  /** Rótulo editorial pequeno (seções, categorias). */
  kicker: "text-[11.5px] font-semibold uppercase tracking-[0.24em] text-brand",
  /** Informação auxiliar pequena (categoria, local). */
  meta: "text-[13px] text-night/55",
  label: "text-[13px] font-medium text-night/70",
  h1: "text-[34px] font-semibold leading-[1.06] tracking-[-0.03em] text-night sm:text-[46px] lg:text-[56px]",
  h2: "text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-night sm:text-[38px] lg:text-[44px]",
  h3: "text-[19px] font-semibold leading-snug tracking-[-0.01em] text-night",
  lead: "text-[17px] leading-relaxed text-night/70 sm:text-[18px]",
  /** Botão principal: azul da logo sobre fundo escuro ou claro. */
  btnGold:
    "group/btn inline-flex h-[52px] items-center justify-center gap-3 bg-brand-logo px-7 text-[15px] font-semibold text-white ring-1 ring-inset ring-white/15 transition-[background-color,transform] duration-300 hover:bg-brand-soft active:scale-[0.99]",
  btnPrimary:
    "inline-flex h-12 items-center justify-center gap-2 bg-coal px-6 text-[15px] font-medium text-white transition-colors duration-300 hover:bg-night-soft disabled:opacity-50",
  btnOutline:
    "inline-flex h-12 items-center justify-center gap-2 border border-night/20 bg-white px-6 text-[15px] font-medium text-night transition-colors duration-300 hover:border-night/60 disabled:opacity-50",
  /** Botão vazado para fundos escuros. */
  btnGhostLight:
    "inline-flex h-[52px] items-center justify-center gap-3 border border-white/35 px-7 text-[15px] font-medium text-white transition-colors duration-300 hover:border-white hover:bg-white/[0.06]",
  btnSmall:
    "inline-flex h-10 items-center justify-center gap-2 bg-coal px-4 text-[14px] font-medium text-white transition-colors duration-300 hover:bg-night-soft",
  link: "inline-flex items-center gap-1.5 text-[15px] font-medium text-night underline decoration-brand/60 decoration-[1.5px] underline-offset-[6px] transition-colors hover:decoration-brand",
  input:
    "mt-1.5 h-12 w-full border border-night/20 bg-white px-3.5 text-[16px] text-night outline-none transition-colors focus:border-brand",
  panel: "border border-night/12 bg-white",
} as const;
