/**
 * Desenhos técnicos das estruturas (traço), feitos a partir das referências da empresa:
 * - "piramide": tenda de 4 águas com saia, quadro interno e 4 pés, em perspectiva 3/4;
 * - "articulada": tenda articulada (sanfonada) em vista frontal, com a treliça em X sob a saia.
 * São ilustrações neutras — não representam um produto específico do catálogo.
 */
export function TentDrawing({ variant = "piramide", className = "", strokeWidth = 1.6 }: { variant?: "piramide" | "articulada"; className?: string; strokeWidth?: number }) {
  if (variant === "articulada") {
    return (
      <svg viewBox="0 0 160 100" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
        {/* pés de trás (mais curtos pela perspectiva) */}
        <path d="M54 46v34M106 46v34" opacity="0.45" />
        {/* telhado baixo de 4 águas */}
        <path d="M10 34 80 15l70 19" />
        <path d="M80 15 54 34M80 15l26 19" opacity="0.45" />
        {/* saia */}
        <path d="M10 34h140v8H10z" />
        {/* treliça articulada (pantográfica) sob a saia */}
        <path d="M14 42l22 8 22-8 22 8 22-8 22 8 22-8M14 50l22-8 22 8 22-8 22 8 22-8 22 8" opacity="0.55" />
        {/* pés da frente */}
        <path d="M14 42v50M146 42v50" />
        {/* chão */}
        <path d="M4 92h152" opacity="0.35" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      {/* sombra no chão */}
      <path d="M14 104 70 114l80-12-54-6z" fill="currentColor" stroke="none" opacity="0.07" />
      {/* pé de trás e quadro interno vistos por baixo do telhado */}
      <path d="M96 47v49" opacity="0.4" />
      <path d="M14 52 96 47l54 3" opacity="0.4" />
      {/* telhado de 4 águas */}
      <path d="M84 10 14 46M84 10l-14 50M84 10l66 34" />
      {/* saia */}
      <path d="M14 46 70 60l80-16M14 52l56 14 80-16M14 46v6M70 60v6M150 44v6" />
      {/* pés */}
      <path d="M14 52v52M70 66v48M150 50v52" />
    </svg>
  );
}
