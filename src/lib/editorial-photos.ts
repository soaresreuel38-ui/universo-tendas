/**
 * Fotos reais da Universo Tendas usadas nas seções da página inicial, tiradas do Instagram da
 * empresa (@universotendas) e otimizadas em /public/fotos (640 e 1080 px de largura).
 * Só aparecem tendas do tipo que a empresa trabalha (quadradas / piramidais).
 */
export type EditorialPhoto = {
  /** nome-base do arquivo em /public/fotos (sem o sufixo de largura) */
  file: string;
  alt: string;
  width: number;
  height: number;
  /** ponto de foco para recortes (object-position) */
  focus?: string;
  /** recorte no celular (tela estreita), quando diferente */
  mobileFocus?: string;
};

export const EDITORIAL = {
  lake: {
    file: "tenda-10x10-lago",
    alt: "Tenda 10x10 da Universo Tendas montada à beira do lago, com o caminhão da empresa",
    width: 1080,
    height: 1080,
    focus: "50% 45%",
  },
  wedding: {
    file: "tenda-10x10-lona-transparente",
    alt: "Tenda 10x10 com lona transparente sobre mesas montadas para uma festa",
    width: 1080,
    height: 1080,
    focus: "55% 55%",
  },
  corporate: {
    file: "tenda-testeiras-impressas",
    alt: "Tenda com testeiras de lona impressa montada para uma empresa",
    width: 1079,
    height: 607,
    focus: "45% 50%",
  },
  agro: {
    file: "stand-show-safra",
    alt: "Stand montado pela Universo Tendas na Show Safra, feira agropecuária",
    width: 813,
    height: 1080,
    focus: "50% 45%",
  },
  publicEvents: {
    file: "tendas-evento-fileira",
    alt: "Fileira de tendas quadradas brancas montadas para um evento",
    width: 1080,
    height: 1080,
    focus: "50% 50%",
  },
  structure: {
    file: "tendas-avenida",
    alt: "Tendas piramidais montadas lado a lado ao longo de uma avenida",
    width: 1080,
    height: 1080,
    focus: "50% 40%",
  },
  field: {
    file: "tenda-10x10-campo",
    alt: "Tenda 10x10 montada em um campo aberto sob céu azul",
    width: 1080,
    height: 608,
    focus: "50% 45%",
  },
  assembly: {
    file: "tenda-10x10-norte-show",
    alt: "Tenda piramidal 10x10 montada para a Norte Show",
    width: 1080,
    height: 607,
    focus: "50% 50%",
  },
} satisfies Record<string, EditorialPhoto>;

const WIDTHS = [640, 1080];

export function editorialSrc(p: EditorialPhoto, w = 1080) {
  return `/fotos/${p.file}-${WIDTHS.includes(w) ? w : 1080}.webp`;
}

export function editorialSrcSet(p: EditorialPhoto) {
  return WIDTHS.map((w) => `${editorialSrc(p, w)} ${w}w`).join(", ");
}
