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
      <main className="bg-white">
        <div className="mx-auto max-w-[1280px] px-5 pb-24 pt-8 sm:px-8 md:pt-10">
          <nav aria-label="Trilha" className={`${ui.meta} flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <Link href="/tendas" className="hover:text-ink">Tendas</Link>
            <span aria-hidden>/</span>
            <Link href={`/tendas?categoria=${encodeURIComponent(p.category)}`} className="hover:text-ink">{p.category}</Link>
          </nav>

          {/* Nome e preço logo acima da fotografia */}
          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
            <h1 className={`${ui.h1} max-w-[18ch] [text-wrap:balance]`}>{p.name}</h1>
            <p className="pb-1.5 text-[17px] text-night">
              {p.rentalPriceCents != null ? (
                <>
                  <span className="text-[24px] font-semibold tracking-[-0.01em]">{money(p.rentalPriceCents)}</span>{" "}
                  <span className="text-night/55">por dia, por {p.unit === "un" ? "unidade" : p.unit}</span>
                </>
              ) : (
                <span className="text-[19px] font-medium text-night/70">Valor a consultar</span>
              )}
            </p>
          </div>

          {/* A fotografia como protagonista */}
          <div className="-mx-5 mt-8 sm:mx-0">
            <Gallery photos={photos} name={p.name} />
          </div>

          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
            <div>
              {p.description ? <p className={`${ui.lead} max-w-2xl whitespace-pre-line`}>{p.description}</p> : null}
              <dl className={`${p.description ? "mt-10" : ""} max-w-2xl border-t border-night/12`}>
                {facts.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 border-b border-night/12 py-3.5 text-[15.5px]">
                    <dt className="text-night/55">{k}</dt>
                    <dd className="text-night">{v}</dd>
                  </div>
                ))}
              </dl>

              {p.model3d ? (
                <div className="mt-12 border-l-2 border-ink pl-6">
                  <h2 className={ui.h3}>Modelo 3D</h2>
                  <p className="mt-2 max-w-md text-[15.5px] leading-relaxed text-night/65">
                    Gire, aproxime e veja a estrutura de todos os ângulos. O modelo só é carregado quando você abrir.
                  </p>
                  <div className="mt-5">
                    <Model3DButton url={p.model3d.url} settings={p.model3d.settings} name={p.name} slug={p.slug} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-28 lg:self-start">
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
