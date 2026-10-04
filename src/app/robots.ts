import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const url = (process.env.SITE_URL || "https://universotendas.com.br").replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/login", "/assinar/", "/minha-reserva"] },
    sitemap: `${url}/sitemap.xml`,
  };
}
