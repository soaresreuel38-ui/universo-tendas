import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/login", "/assinar/", "/minha-reserva"] },
    sitemap: `${url}/sitemap.xml`,
  };
}
