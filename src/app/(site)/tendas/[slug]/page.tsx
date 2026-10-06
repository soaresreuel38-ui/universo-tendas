import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AvailabilityCheck } from "@/components/site/AvailabilityCheck";
import { Gallery } from "@/components/site/Gallery";
import { Model3DButton } from "@/components/site/Model3DButton";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { TrackView } from "@/components/site/TrackView";
import { ui } from "@/components/site/ui";
import { money } from "@/lib/format";
import { publicPhotoUrl } from "@/lib/public-urls";
import { prisma } from "@/server/db";
import { findPublicProduct, productPath, productPhotos } from "@/server/public-booking";
import { serializeProduct } from "@/server/public-serialize";
import { getSiteSettings } from "@/server/site-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await findPublicProduct(prisma, (await params).slug);
  if (!p) return { title: "Tenda não encontrada", robots: { index: false } };
  const photo = productPhotos(p)[0];
  // Somente informações reais cadastradas.
  const description = [p.description?.slice(0, 150), p.dimensions, "Locação em Sinop - MT."].filter(Boolean).join(" · ");
  return {
    title: `${p.name} — locação`,
    description,
    alternates: { canonical: productPath(p) },
    openGraph: { title: p.name, description, ...(photo ? { images: [publicPhotoUrl(photo)] } : {}) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await findPublicProduct(prisma, slug);
  if (!product) notFound();
  // URL antiga por id → endereço definitivo com o nome.
  if (product.slug && slug !== product.slug) permanentRedirect(productPath(product));
  const settings = await getSiteSettings();
  const p = serializeProduct(product);
  const photos = p.photos.map((x) => x.id);

  const facts: Array<[string, string]> = [
    ["Código", p.code],
    ["Categoria", p.category],
    ...(p.dimensions ? ([["Tamanho", p.dimensions]] as Array<[string, string]>) : []),
    ["Unidade", p.unit],
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.code,
    category: p.category,
    ...(p.description ? { description: p.description } : {}),
    ...(photos.length ? { image: photos.map((id) => publicPhotoUrl(id)) } : {}),
    ...(p.rentalPriceCents != null ? { offers: { "@type": "Offer", priceCurrency: "BRL", price: (p.rentalPriceCents / 100).toFixed(2) } } : {}),
  };

  return (
    <>
      <SiteHeader />
      <TrackView event="product_view" props={{ product: p.slug }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main className="mx-auto max-w-[1360px] px-5 pb-28 pt-8 sm:px-10 md:pt-12">
        <nav aria-label="Trilha" className={`${ui.label} flex flex-wrap items-center gap-x-3 gap-y-1 text-night/45`}>
          <Link href="/tendas" className="hover:text-night">Tendas</Link>
          <span aria-hidden>/</span>
          <Link href={`/tendas?categoria=${encodeURIComponent(p.category)}`} className="hover:text-night">{p.category}</Link>
        </nav>

        <div className="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-[1.45fr_1fr] lg:gap-16">
          <div className="-mx-5 min-w-0 sm:mx-0">
            <Gallery photos={photos} name={p.name} />
            {p.model3d ? (
              <div className="mt-6 px-5 sm:px-0">
                <Model3DButton url={p.model3d.url} settings={p.model3d.settings} name={p.name} slug={p.slug} />
              </div>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className={`${ui.eyebrow} text-night/45`}>{p.category}</p>
            <h1 className="mt-4 text-[30px] font-semibold uppercase leading-[1.04] tracking-[-0.015em] [text-wrap:balance] sm:text-[40px]">{p.name}</h1>
            <p className="mt-6 flex items-baseline gap-2 border-y border-night/12 py-5">
              {p.rentalPriceCents != null ? (
                <>
                  <span className="text-[28px] font-semibold tracking-[-0.01em]">{money(p.rentalPriceCents)}</span>
                  <span className="text-[14px] text-night/55">/ dia por {p.unit === "un" ? "unidade" : p.unit}</span>
                </>
              ) : (
                <span className="text-[18px] font-semibold uppercase tracking-[0.04em] text-night/70">Valor a consultar</span>
              )}
            </p>
            {p.description ? <p className="mt-6 whitespace-pre-line text-[16px] leading-relaxed text-night/70">{p.description}</p> : null}

            <dl className="mt-8 border-t border-night/12">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 border-b border-night/12 py-3.5">
                  <dt className={ui.label}>{k}</dt>
                  <dd className="text-right text-[15px] text-night">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10">
              {settings.booking.enabled ? (
                <AvailabilityCheck productId={p.id} slug={p.slug} unit={p.unit} />
              ) : (
                <p className={`${ui.panel} p-5 text-[15px] text-night/70`}>As reservas pelo site estão pausadas. Fale com a gente pelo WhatsApp.</p>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
