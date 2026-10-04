import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { bookingSettings } from "./public-booking";

/** Dados da empresa exibidos no site — exatamente o que está em Configurações (nada inventado). */
export const getSiteSettings = cache(async () => {
  const s = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  const booking = await bookingSettings(prisma);
  return {
    companyName: s?.companyName ?? "Universo Tendas",
    city: s?.city ?? "Sinop - MT",
    phones: s?.phones ?? null,
    whatsappNumber: s?.whatsappNumber ?? null,
    instagram: s?.instagram ?? null,
    address: s?.address ?? null,
    booking,
  };
});

export type SiteSettings = Awaited<ReturnType<typeof getSiteSettings>>;

export const instagramUrl = (handle: string | null) => (handle ? `https://instagram.com/${handle.replace(/^@/, "")}` : null);
