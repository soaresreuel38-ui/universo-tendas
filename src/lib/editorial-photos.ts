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
  // Só tendas do tipo que a empresa trabalha (estrutura com cobertura baixa / piramidal). Nada de "chapéu de bruxa".
  hero: {
    id: "photo-1519226612673-73c0234437ef",
    alt: "Grande tenda de estrutura iluminada ao entardecer durante uma festa",
    author: "Photos by Lanty",
    page: "https://unsplash.com/photos/dcb2pog89fQ",
    width: 5221,
    height: 3481,
    focus: "50% 100%",
    mobileFocus: "30% 100%",
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
    id: "photo-1692166927778-056466153552",
    alt: "Tenda branca de estrutura montada para um evento ao ar livre",
    author: "Jennifer Kalenberg",
    page: "https://unsplash.com/photos/Q51MfLHBlHM",
    width: 4000,
    height: 2667,
    focus: "45% 45%",
  },
  night: {
    id: "photo-1651065697481-bc08bb5ad40d",
    alt: "Grande tenda de estrutura iluminada à noite durante uma festa",
    author: "Flavio Anibal",
    page: "https://unsplash.com/photos/g7VQ1ttM9vg",
    width: 5367,
    height: 3578,
    focus: "35% 45%",
  },
  reception: {
    id: "photo-1780682568331-2bc7318210ce",
    alt: "Tenda de cobertura piramidal com mesas arrumadas para uma recepção",
    author: "Jonathan Borba",
    page: "https://unsplash.com/photos/OITmZi16NqI",
    width: 8192,
    height: 5464,
    focus: "50% 45%",
  },
  structure: {
    id: "photo-1694578345441-c8ebfb5258fc",
    alt: "Interior de uma tenda de estrutura mostrando a cobertura e as laterais",
    author: "Sean Thoman",
    page: "https://unsplash.com/photos/R7-VnFzk0gg",
    width: 5760,
    height: 3840,
    focus: "50% 35%",
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
