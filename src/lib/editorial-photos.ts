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
  /** larguras disponíveis em /public/fotos (padrão: 640 e 1080) */
  widths?: number[];
};

export const EDITORIAL = {
  // Capa: imagem ilustrativa (licença Unsplash, foto de boris misevic), mantida a pedido da empresa e marcada como ilustrativa.
  hero: {
    file: "capa-ceu-azul",
    alt: "Cumeeiras de uma grande tenda branca contra o céu azul",
    width: 2560,
    height: 1440,
    focus: "50% 100%",
    mobileFocus: "22% 100%",
    widths: [640, 1080, 1440, 1920, 2560],
  },
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
  const widths = p.widths ?? WIDTHS;
  return `/fotos/${p.file}-${widths.includes(w) ? w : 1080}.webp`;
}

export function editorialSrcSet(p: EditorialPhoto) {
  return (p.widths ?? WIDTHS).map((w) => `${editorialSrc(p, w)} ${w}w`).join(", ");
}
