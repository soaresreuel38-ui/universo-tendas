import type { Metadata } from "next";
import Link from "next/link";
import { BookingWizard, type WizardProduct } from "@/components/site/BookingWizard";
import { Brand } from "@/components/site/SiteChrome";
import { DATE_KEY_RE } from "@/lib/time";
import { prisma } from "@/server/db";
import { listPublicProducts, productPhotos } from "@/server/public-booking";
import { getSiteSettings } from "@/server/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservar uma tenda",
  description: "Escolha a tenda, a data e o local do evento e faça sua reserva online com a Universo Tendas.",
  alternates: { canonical: "/reservar" },
};

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ tenda?: string; inicio?: string; fim?: string }> }) {
  const sp = await searchParams;
  const [settings, products] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);
  const list: WizardProduct[] = products.map((p) => ({
    id: p.id,
    slug: p.slug ?? p.id,
    name: p.name,
    code: p.sku,
    category: p.category,
    dimensions: p.dimensions,
    unit: p.unit,
    rentalPriceCents: p.rentalPriceCents,
    photoId: productPhotos(p)[0] ?? null,
  }));
  const initialProduct = list.find((p) => p.slug === sp.tenda?.toLowerCase() || p.id === sp.tenda)?.id ?? null;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-night/10 bg-linen">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Universo Tendas — início">
            <Brand />
          </Link>
          <Link href="/tendas" className="text-[13px] text-night/60 hover:text-night">Sair</Link>
        </div>
      </header>
      {settings.booking.enabled && list.length ? (
        <BookingWizard
          products={list}
          initialProductId={initialProduct}
          initialStart={sp.inicio && DATE_KEY_RE.test(sp.inicio) ? sp.inicio : ""}
          initialEnd={sp.fim && DATE_KEY_RE.test(sp.fim) ? sp.fim : ""}
          companyWhatsapp={settings.whatsappNumber}
          daysBefore={settings.booking.daysBefore}
          daysAfter={settings.booking.daysAfter}
        />
      ) : (
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <p className="font-display text-3xl font-light">{list.length ? "As reservas pelo site estão pausadas no momento." : "O catálogo está sendo preparado."}</p>
          <p className="mt-4 text-night/65">Fale com a gente pelo WhatsApp para consultar disponibilidade.</p>
        </main>
      )}
    </div>
  );
}
