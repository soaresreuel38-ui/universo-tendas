import type { Metadata } from "next";
import Link from "next/link";
import { TentDrawing } from "@/components/brand/TentDrawing";
import { Photo } from "@/components/site/Photo";
import { QUOTE_HREF, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { ui } from "@/components/site/ui";
import { formatPhoneDisplay } from "@/lib/br-documents";
import { money, whatsappLink } from "@/lib/format";
import { prisma } from "@/server/db";
import { listPublicProducts, productPath, productPhotos } from "@/server/public-booking";
import { getSiteSettings, instagramUrl } from "@/server/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Universo Tendas | Locação de Tendas em Sinop - MT" },
  description: "Locação de tendas e estruturas para eventos em Sinop e região. Escolha a estrutura, informe a data e o local e solicite o orçamento.",
  alternates: { canonical: "/" },
};

const STEPS = [
  ["Escolha a estrutura", "Veja as tendas do catálogo, com fotos e informações de cada uma."],
  ["Informe a data e o local", "O site mostra na hora quantas unidades estão livres para o período do evento."],
  ["Envie o pedido", "A equipe confere os detalhes e retorna pelo WhatsApp para confirmar a locação."],
] as const;

export default async function HomePage() {
  const [settings, products] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);

  // Fotos reais cadastradas no painel. Capa: 1ª foto do 1º produto em "Destaque" (ou do 1º produto com foto).
  const withPhotos = products.filter((p) => productPhotos(p).length);
  const cover = withPhotos.find((p) => p.featured) ?? withPhotos[0] ?? null;
  const coverPhoto = cover ? productPhotos(cover)[0] : null;
  // Uma segunda foto real (se houver) para a faixa entre as seções.
  const bandPhoto = withPhotos.flatMap((p) => productPhotos(p).map((id) => ({ id, name: p.name }))).find((x) => x.id !== coverPhoto) ?? null;
  // Estruturas em destaque primeiro; o catálogo completo fica em /tendas.
  const shown = [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 5);
  const [lead, ...rest] = shown;

  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas e gostaria de um orçamento.");
  const ig = instagramUrl(settings.instagram);
  const mapQuery = encodeURIComponent(`${settings.address ? `${settings.address}, ` : ""}${settings.city}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings.companyName,
    ...(settings.address ? { address: { "@type": "PostalAddress", streetAddress: settings.address, addressLocality: "Sinop", addressRegion: "MT", addressCountry: "BR" } } : {}),
    areaServed: "Sinop e região",
    ...(settings.whatsappNumber ? { telephone: `+${settings.whatsappNumber}` } : {}),
    ...(ig ? { sameAs: [ig] } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteHeader />

      {/* Abertura: texto direto à esquerda, a fotografia real ocupando o lado direito sem nada por cima */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-[1280px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col justify-center px-5 pb-10 pt-12 sm:px-8 lg:py-24 lg:pr-14">
            <p className={ui.meta}>Universo Tendas · {settings.city}</p>
            <h1 className={`${ui.h1} mt-4 [text-wrap:balance]`}>Locação de tendas para eventos em Sinop e região.</h1>
            <p className={`${ui.lead} mt-5 max-w-md`}>
              Escolha a estrutura, informe a data e o local. Nossa equipe confirma a disponibilidade e cuida da montagem e da desmontagem.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href={QUOTE_HREF} className={ui.btnPrimary}>
                Solicitar orçamento
              </Link>
              <Link href="/tendas" className={ui.link}>
                Ver as tendas
              </Link>
            </div>
            {wa && settings.whatsappNumber ? (
              <p className="mt-10 border-t border-night/10 pt-5 text-[14.5px] text-night/60">
                Prefere conversar? WhatsApp{" "}
                <a href={wa} target="_blank" rel="noopener noreferrer" className="text-night underline decoration-night/25 underline-offset-4 hover:decoration-night">
                  {formatPhoneDisplay(settings.whatsappNumber)}
                </a>
                {settings.phones ? <> · Telefone {settings.phones.split("·")[0].trim()}</> : null}
              </p>
            ) : null}
          </div>
          <figure className="relative lg:pl-0">
            <div className="relative aspect-[4/3] w-full bg-linen sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[620px]">
              {coverPhoto && cover ? (
                <Photo id={coverPhoto} alt={cover.name} priority sizes="(min-width: 1024px) 58vw, 100vw" />
              ) : (
                <div className="flex h-full items-center justify-center" aria-hidden>
                  <TentDrawing strokeWidth={0.9} className="w-[62%] max-w-[460px] text-night/20" />
                </div>
              )}
            </div>
            {cover ? (
              <figcaption className="px-5 pt-3 text-[13px] text-night/50 sm:px-8 lg:absolute lg:bottom-0 lg:left-0 lg:bg-white lg:px-4 lg:py-2.5">
                Na foto: <Link href={productPath(cover)} className="text-night underline decoration-night/25 underline-offset-4 hover:decoration-night">{cover.name}</Link>
              </figcaption>
            ) : null}
          </figure>
        </div>
      </section>

      {/* Estruturas: a primeira em destaque, as demais em composição livre */}
      <section id="estruturas" className="scroll-mt-24 border-t border-night/10 bg-white py-20 sm:py-24" aria-labelledby="estruturas-titulo">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="estruturas-titulo" className={ui.h2}>Estruturas para locação</h2>
            <Link href="/tendas" className={ui.link}>Ver o catálogo completo</Link>
          </div>

          {lead ? (
            <>
              <article className="reveal mt-10 grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:items-end lg:gap-10">
                <Link href={productPath(lead)} className="group -mx-5 block overflow-hidden bg-linen sm:mx-0">
                  <div className="aspect-[3/2]">
                    <Photo id={productPhotos(lead)[0]} alt={lead.name} className="transition-transform duration-[1.4s] ease-out group-hover:scale-[1.03]" sizes="(min-width: 1024px) 66vw, 100vw" />
                  </div>
                </Link>
                <ProductText p={lead} large />
              </article>

              {rest.length ? (
                <div className="mt-16 grid gap-x-10 gap-y-14 sm:grid-cols-2">
                  {rest.map((p, i) => (
                    <article key={p.id} className={`reveal ${i % 2 ? "sm:mt-16" : ""}`}>
                      <Link href={productPath(p)} className="group block overflow-hidden bg-linen">
                        <div className={i % 3 === 0 ? "aspect-[4/5]" : "aspect-[4/3]"}>
                          <Photo id={productPhotos(p)[0]} alt={p.name} size="full" className="transition-transform duration-[1.4s] ease-out group-hover:scale-[1.03]" sizes="(min-width: 640px) 50vw, 100vw" />
                        </div>
                      </Link>
                      <div className="mt-5">
                        <ProductText p={p} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-10 max-w-lg text-[17px] text-night/65">
              O catálogo está sendo preparado. Para consultar as estruturas disponíveis, fale com a gente pelo WhatsApp.
            </p>
          )}
        </div>
      </section>

      {/* Faixa fotográfica: só aparece quando existe mais uma foto real cadastrada */}
      {bandPhoto ? (
        <figure className="relative bg-linen">
          <div className="mx-auto aspect-[16/9] max-h-[640px] w-full sm:aspect-[21/9]">
            <Photo id={bandPhoto.id} alt={bandPhoto.name} sizes="100vw" />
          </div>
        </figure>
      ) : null}

      {/* Como solicitar: três passos em texto corrido, sem cartões */}
      <section id="como-solicitar" className="scroll-mt-24 bg-linen py-20 sm:py-24" aria-labelledby="como-titulo">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-20">
          <div className="reveal">
            <h2 id="como-titulo" className={ui.h2}>Como solicitar um orçamento</h2>
            <p className={`${ui.lead} mt-4 max-w-sm`}>Pelo site, sem cadastro. O pedido chega direto para a nossa equipe.</p>
            <Link href={QUOTE_HREF} className={`${ui.btnPrimary} mt-8`}>
              Solicitar orçamento
            </Link>
          </div>
          <ol className="reveal border-t border-night/15">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-night/15 py-6 sm:grid-cols-[3rem_14rem_1fr] sm:items-baseline">
                <span className="text-[15px] font-semibold text-ink tabular">{i + 1}.</span>
                <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-night">{title}</h3>
                <p className="col-start-2 mt-1 text-[15.5px] leading-relaxed text-night/65 sm:col-start-3 sm:mt-0">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* A empresa e o contato, juntos: quem somos, onde estamos e como falar com a gente */}
      <section id="empresa" className="scroll-mt-24 bg-white py-20 sm:py-24" aria-labelledby="empresa-titulo">
        <div className="mx-auto grid max-w-[1280px] gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-24">
          <div className="reveal">
            <h2 id="empresa-titulo" className={ui.h2}>{settings.companyName}</h2>
            <div className={`${ui.lead} mt-5 max-w-xl space-y-4`}>
              <p>
                Empresa de locação de tendas e estruturas para eventos em {settings.city}. Atendemos eventos sociais, empresas e projetos na
                cidade e na região.
              </p>
              <p>A montagem e a desmontagem são feitas pela nossa equipe, no endereço do evento.</p>
            </div>
          </div>
          <div id="contato" className="reveal scroll-mt-24">
            <dl className="divide-y divide-night/10 border-y border-night/10 text-[15.5px]">
              {settings.address ? (
                <ContactRow label="Endereço">
                  {settings.address}
                  <br />
                  {settings.city}{" "}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                    ver no mapa
                  </a>
                </ContactRow>
              ) : null}
              {settings.phones ? <ContactRow label="Telefone">{settings.phones.split("·")[0].trim()}</ContactRow> : null}
              {wa && settings.whatsappNumber ? (
                <ContactRow label="WhatsApp">
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                    {formatPhoneDisplay(settings.whatsappNumber)}
                  </a>
                </ContactRow>
              ) : null}
              {ig ? (
                <ContactRow label="Instagram">
                  <a href={ig} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                    {settings.instagram}
                  </a>
                </ContactRow>
              ) : null}
            </dl>
          </div>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </>
  );
}

function ProductText({ p, large = false }: { p: Awaited<ReturnType<typeof listPublicProducts>>[number]; large?: boolean }) {
  return (
    <div>
      <p className={ui.meta}>
        {p.category}
        {p.dimensions ? ` · ${p.dimensions}` : ""}
      </p>
      <h3 className={`mt-1.5 font-semibold tracking-[-0.015em] text-night ${large ? "text-[26px] sm:text-[30px]" : "text-[21px]"}`}>
        <Link href={productPath(p)} className="hover:text-ink">{p.name}</Link>
      </h3>
      {p.description ? <p className={`mt-2 text-[15.5px] leading-relaxed text-night/65 ${large ? "line-clamp-4" : "line-clamp-2"}`}>{p.description}</p> : null}
      <p className="mt-3 text-[15.5px] text-night">
        {p.rentalPriceCents != null ? (
          <>
            {money(p.rentalPriceCents)} <span className="text-night/55">por dia</span>
          </>
        ) : (
          <span className="text-night/60">Valor a consultar</span>
        )}
      </p>
      <Link href={productPath(p)} className={`${ui.link} mt-4`}>
        Ver estrutura
      </Link>
    </div>
  );
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-4 py-4">
      <dt className="text-night/50">{label}</dt>
      <dd className="text-night">{children}</dd>
    </div>
  );
}
