import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { AvailabilityCheck } from "@/components/site/AvailabilityCheck";
import { Gallery } from "@/components/site/Gallery";
import { Model3DButton } from "@/components/site/Model3DButton";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { TrackView } from "@/components/site/TrackView";
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
      <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-8 sm:px-8 md:pt-12">
        <nav aria-label="Trilha" className="text-[13px] text-night/55">
          <Link href="/tendas" className="link-grow">Tendas</Link>
          <span className="mx-2">/</span>
          <Link href={`/tendas?categoria=${encodeURIComponent(p.category)}`} className="link-grow">{p.category}</Link>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <Gallery photos={photos} name={p.name} />
            {p.model3d ? (
              <div className="mt-6">
                <Model3DButton url={p.model3d.url} settings={p.model3d.settings} name={p.name} slug={p.slug} />
              </div>
            ) : null}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-night/45">{p.category}</p>
            <h1 className="mt-3 font-display text-[38px] font-light leading-[1.05] tracking-[-0.02em] md:text-[52px]">{p.name}</h1>
            <p className="mt-5 text-[17px]">
              {p.rentalPriceCents != null ? (
                <>
                  <span className="font-display text-[30px]">{money(p.rentalPriceCents)}</span>
                  <span className="text-night/55"> / dia por {p.unit === "un" ? "unidade" : p.unit}</span>
                </>
              ) : (
                <span className="text-night/65">Valor a consultar</span>
              )}
            </p>
            {p.description ? <p className="mt-6 whitespace-pre-line text-[16px] leading-relaxed text-night/75">{p.description}</p> : null}

            <dl className="mt-8 divide-y divide-night/10 border-y border-night/10 text-[15px]">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 py-3">
                  <dt className="text-night/55">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8">
              {settings.booking.enabled ? (
                <AvailabilityCheck productId={p.id} slug={p.slug} unit={p.unit} />
              ) : (
                <p className="rounded-[4px] bg-white p-5 text-[15px] text-night/70">As reservas pelo site estão pausadas. Fale com a gente pelo WhatsApp.</p>
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
