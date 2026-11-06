/**
 * Fotografias ilustrativas do site público (licença Unsplash, uso comercial gratuito).
 * NÃO são fotos de trabalhos da Universo Tendas: toda imagem daqui aparece com o selo
 * "Imagem ilustrativa". As fotos reais da empresa vêm sempre do catálogo (painel).
 */
export type EditorialPhoto = {
  /** id do arquivo no CDN do Unsplash */
  id: string;
  alt: string;
  author: string;
  /** página da foto no Unsplash (crédito) */
  page: string;
  width: number;
  height: number;
  /** ponto de foco para recortes (object-position) */
  focus?: string;
  /** recorte no celular (tela estreita), quando diferente */
  mobileFocus?: string;
};

export const EDITORIAL = {
  hero: {
    id: "photo-1711953748361-3867a56c878c",
    alt: "Cumeeiras de uma grande tenda branca contra o céu azul",
    author: "boris misevic",
    page: "https://unsplash.com/photos/ff3YnbuT5ZA",
    width: 6000,
    height: 3376,
    focus: "50% 100%",
    mobileFocus: "22% 100%",
  },
  clearSpan: {
    id: "photo-1675376616537-c8aa9ddc9977",
    alt: "Grande tenda branca de estrutura retangular montada em um gramado",
    author: "Steven Van Elk",
    page: "https://unsplash.com/photos/6WzXEYnPcgo",
    width: 5472,
    height: 3648,
    focus: "50% 70%",
  },
  wedding: {
    id: "photo-1772127822525-7eda37383b9f",
    alt: "Recepção ao ar livre sob tecidos, com mesas e lustres",
    author: "Vidit Goswami",
    page: "https://unsplash.com/photos/Zi_NOBHIk9A",
    width: 8736,
    height: 5824,
    focus: "50% 55%",
  },
  corporate: {
    id: "photo-1786295259311-8edeec64bb7a",
    alt: "Mesas arrumadas sob uma tenda decorada com plantas",
    author: "Annie Spratt",
    page: "https://unsplash.com/photos/ZtmJ4B2R02A",
    width: 6000,
    height: 4500,
    focus: "50% 60%",
  },
  agro: {
    id: "photo-1786019932386-997dbb5caf21",
    alt: "Várias tendas brancas montadas em um campo aberto sob céu com nuvens",
    author: "David Billington",
    page: "https://unsplash.com/photos/9n4HmKZf_F0",
    width: 5741,
    height: 3994,
    focus: "50% 70%",
  },
  night: {
    id: "photo-1781873464772-d9dfbe28b46f",
    alt: "Tenda iluminada à noite durante um evento",
    author: "Nellie Adamyan",
    page: "https://unsplash.com/photos/sIUbsedOQaA",
    width: 5304,
    height: 7952,
    focus: "50% 72%",
  },
  structure: {
    id: "photo-1785081811283-868120946987",
    alt: "Detalhe de uma estrutura de lona tensionada com mastro metálico",
    author: "Wenxuan Zou",
    page: "https://unsplash.com/photos/xxPlvm7ON_M",
    width: 6048,
    height: 4032,
    focus: "60% 40%",
  },
} satisfies Record<string, EditorialPhoto>;

const WIDTHS = [480, 768, 1080, 1440, 1920, 2560];

export function editorialSrc(p: EditorialPhoto, w: number) {
  return `https://images.unsplash.com/${p.id}?w=${w}&q=72&auto=format&fit=max`;
}

export function editorialSrcSet(p: EditorialPhoto, max = 2560) {
  return WIDTHS.filter((w) => w <= max)
    .map((w) => `${editorialSrc(p, w)} ${w}w`)
    .join(", ");
}
