import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { prisma } from "@/server/db";
import { listPublicProducts, productPath } from "@/server/public-booking";

// Gerado a cada requisição: produtos novos entram no sitemap sem novo deploy.
export const dynamic = "force-dynamic";

const base = siteUrl;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = base();
  const products = await listPublicProducts(prisma).catch(() => []);
  return [
    { url: `${url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/tendas`, changeFrequency: "daily", priority: 0.9 },
    { url: `${url}/reservar`, changeFrequency: "monthly", priority: 0.6 },
    ...products.map((p) => ({ url: `${url}${productPath(p)}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
