/** Domínio oficial do site da Universo Tendas. */
export const OFFICIAL_SITE_URL = "https://universotendas.app.br";

/**
 * URL pública usada em canonical, Open Graph, sitemap, robots e links enviados aos clientes.
 * Vem de SITE_URL (configurada na Vercel); sem ela, o domínio oficial.
 */
export const siteUrl = () => (process.env.SITE_URL?.trim() || OFFICIAL_SITE_URL).replace(/\/+$/, "");
