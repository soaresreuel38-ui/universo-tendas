import type { Metadata } from "next";
import Link from "next/link";
import { preconnect, preload } from "react-dom";
import { EditorialImage } from "@/components/site/EditorialImage";
import { Footprint, areaLabel, parseDimensions } from "@/components/site/Footprint";
import { HomeGallery, type GalleryItem } from "@/components/site/HomeGallery";
import { ArrowRight, WhatsAppIcon } from "@/components/site/Icons";
import { Photo } from "@/components/site/Photo";
import { QUOTE_HREF, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { formatPhoneDisplay } from "@/lib/br-documents";
import { EDITORIAL, editorialSrc, editorialSrcSet } from "@/lib/editorial-photos";
import { money, whatsappLink } from "@/lib/format";
import { prisma } from "@/server/db";
import { photoSize } from "@/server/image-size";
import { listPublicProducts, productPath, productPhotos } from "@/server/public-booking";
import { getSiteSettings, instagramUrl } from "@/server/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Universo Tendas | Locação de Tendas em Sinop - MT" },
  description:
    "Locação de tendas e estruturas para eventos em Sinop e região, com montagem e desmontagem pela nossa equipe. Consulte a disponibilidade e solicite o orçamento.",
  alternates: { canonical: "/" },
};

/** Tipos de evento atendidos (confirmados pela empresa). Fotografias ilustrativas. */
const APPLICATIONS = [
  { key: "wedding", title: "Casamentos e festas", text: "Casamentos, aniversários, formaturas e festas particulares.", photo: EDITORIAL.wedding },
  { key: "corporate", title: "Eventos corporativos", text: "Lançamentos, confraternizações e eventos de empresas.", photo: EDITORIAL.corporate },
  { key: "agro", title: "Agro e feiras", text: "Dias de campo, feiras agropecuárias, leilões e exposições.", photo: EDITORIAL.agro },
  { key: "night", title: "Eventos públicos", text: "Shows, eventos municipais, igrejas, esportes e comércio.", photo: EDITORIAL.night },
] as const;

/** Diferenciais reais do serviço. */
const DIFFERENTIALS = [
  ["Montagem e desmontagem", "Nossa equipe leva a estrutura, monta no endereço do evento e retira depois."],
  ["Disponibilidade na hora", "Pelo site você vê quantas unidades estão livres para os dias do seu evento."],
  ["Atendimento direto", "Do primeiro contato à confirmação, você fala com a nossa equipe pelo WhatsApp."],
  ["Reserva acompanhada", "Cada pedido tem número, contrato e acompanhamento online, sem cadastro."],
] as const;

/** Como a locação funciona de fato no sistema. */
const STEPS = [
  ["Escolha a estrutura e as datas", "O site mostra, na hora, o que está livre para o seu evento."],
  ["Envie o pedido", "Pelo site ou pelo WhatsApp. Cada pedido recebe um número para acompanhar online."],
  ["Confirmação e contrato", "Nossa equipe analisa, confirma a reserva e envia o contrato."],
  ["Montagem e retirada", "Levamos a estrutura, montamos no local do evento e retiramos depois."],
] as const;

type Product = Awaited<ReturnType<typeof listPublicProducts>>[number];

export default async function HomePage() {
  const [settings, products] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);

  // Fotos reais do catálogo (painel). Uma foto real grande em "Destaque" assume a capa no lugar da ilustrativa.
  const withPhotos = products.filter((p) => productPhotos(p).length);
  const featuredReal = withPhotos.find((p) => p.featured) ?? null;
  const featuredRealPhoto = featuredReal ? productPhotos(featuredReal)[0] : null;
  const featuredSize = featuredRealPhoto ? await photoSize(featuredRealPhoto) : null;
  const realHero = featuredRealPhoto && featuredSize && featuredSize.width >= 2000 ? { id: featuredRealPhoto, product: featuredReal! } : null;

  // Foto real para o catálogo: a maior foto cadastrada (lida do arquivo).
  const realCandidates = await Promise.all(
    withPhotos.map(async (p) => ({ p, id: productPhotos(p)[0], size: await photoSize(productPhotos(p)[0]) })),
  );
  const catalogPhoto = realCandidates.filter((c) => c.size && c.size.width >= 900).sort((a, b) => (b.size?.width ?? 0) - (a.size?.width ?? 0))[0] ?? null;

  const allPhotos: GalleryItem[] = withPhotos.flatMap((p) => productPhotos(p).map((id) => ({ id, name: p.name, path: productPath(p) })));

  // Catálogo como quadro técnico: tendas por área (planta em escala), depois os equipamentos.
  const rows = products.map((p) => ({ p, dim: parseDimensions(p.dimensions, p.name) }));
  const tents = rows.filter((r) => r.dim).sort((a, b) => a.dim!.area - b.dim!.area);
  const others = rows.filter((r) => !r.dim);
  const maxSide = Math.max(1, ...tents.map((r) => Math.max(r.dim!.w, r.dim!.d)));

  // Foto da capa: conexão e download começam antes do HTML terminar (melhora o LCP).
  if (!realHero) {
    preconnect("https://images.unsplash.com");
    preload(editorialSrc(EDITORIAL.hero, 1440), { as: "image", imageSrcSet: editorialSrcSet(EDITORIAL.hero), imageSizes: "100vw", fetchPriority: "high" });
  }

  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas e gostaria de falar sobre uma estrutura para o meu evento.");
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
      <SiteHeader overlay />

      {/* ═════════════ Capa: a tenda domina a tela ═════════════ */}
      <section className="relative isolate flex min-h-svh flex-col overflow-hidden bg-abismo text-white" aria-labelledby="capa-titulo">
        <div className="absolute inset-0 -z-10 animate-unveil" aria-hidden>
          {realHero ? (
            <Photo id={realHero.id} alt="" priority sizes="100vw" />
          ) : (
            <EditorialImage photo={EDITORIAL.hero} sizes="100vw" priority decorative label={false} className="h-full w-full" />
          )}
          {/* leitura: escurece só o alto (onde fica o título) e a base (onde fica o carimbo) */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,20,40,0.55)_0%,rgba(7,20,40,0.12)_38%,rgba(7,20,40,0)_55%,rgba(7,20,40,0.5)_100%)]" />
        </div>

        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pb-6 pt-[104px] sm:px-8 sm:pt-[116px] lg:px-10 lg:pb-10">
          <h1 id="capa-titulo" className="text-[clamp(34px,7vw,112px)] font-semibold uppercase leading-[0.98] tracking-[-0.04em]">
            <span className="-mt-[0.1em] block overflow-hidden pb-[0.04em] pt-[0.1em]">
              <span className="block animate-line-up [animation-delay:120ms]">Grandes</span>
            </span>
            <span className="-mt-[0.1em] block overflow-hidden pb-[0.04em] pt-[0.1em]">
              <span className="block animate-line-up [animation-delay:200ms]">estruturas.</span>
            </span>
            <span className="-mt-[0.1em] block overflow-hidden pb-[0.04em] pt-[0.1em] lg:pl-[12%]">
              <span className="block animate-line-up [animation-delay:280ms]">Experiências</span>
            </span>
            <span className="-mt-[0.1em] block overflow-hidden pb-[0.04em] pt-[0.1em] lg:pl-[12%]">
              <span className="block animate-line-up [animation-delay:360ms]">extraordinárias.</span>
            </span>
          </h1>
          <p className="mt-7 max-w-[30rem] animate-block-in text-[16px] leading-relaxed text-white/90 [animation-delay:520ms] sm:text-[18px] lg:ml-[12%]">
            Locação de tendas e estruturas para eventos em Sinop e região, com montagem e desmontagem pela nossa equipe.
          </p>

          <div className="mt-8 grid flex-1 content-between gap-4 sm:mt-auto sm:flex-none sm:pt-12 lg:grid-cols-12 lg:items-end">
            {!realHero ? <p className="order-2 text-[11.5px] text-white/70 lg:order-1 lg:col-span-4">Imagem ilustrativa</p> : <span className="hidden lg:block lg:col-span-4" />}
            <div className="order-1 animate-block-in [animation-delay:620ms] lg:order-2 lg:col-span-6 lg:col-start-7">
              <TitleBlock
                rows={[
                  ["Atendimento", "Sinop e região"],
                  ["Montagem", "Pela nossa equipe"],
                ]}
                wa={wa}
                compactOnMobile
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════ A empresa: texto editorial + fotografia que sangra a margem ═════════════ */}
      <section id="empresa" className="scroll-mt-16 overflow-hidden bg-white py-24 sm:py-36" aria-labelledby="empresa-titulo">
        <div className="mx-auto grid max-w-[1440px] gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:px-10">
          <div className="reveal lg:col-span-5 lg:pt-6">
            <h2 id="empresa-titulo" className="text-[34px] font-semibold leading-[1.02] tracking-[-0.035em] text-tinta [text-wrap:balance] sm:text-[48px] lg:text-[56px]">
              Estrutura, experiência e confiança em cada projeto.
            </h2>
            <div className="mt-8 max-w-[34rem] space-y-5 text-[17px] leading-[1.65] text-tinta/70 sm:text-[18px]">
              <p>
                A {settings.companyName} é especializada em locação de tendas e estruturas para eventos em {settings.city} e região, de encontros
                sociais a eventos corporativos.
              </p>
              <p>
                Cada locação é planejada em torno da data e do local do seu evento: a nossa equipe leva a estrutura, faz a montagem e retira depois,
                para que você possa se concentrar no que importa.
              </p>
            </div>
            <dl className="mt-12 grid grid-cols-2 border-t border-tinta/15 text-[15px]">
              <div className="border-r border-tinta/15 py-5 pr-5">
                <dt className="text-[13px] text-tinta/65">Onde estamos</dt>
                <dd className="mt-1 text-tinta">{settings.address ? `${settings.address}, ` : ""}{settings.city}</dd>
              </div>
              <div className="py-5 pl-5">
                <dt className="text-[13px] text-tinta/65">Atendimento</dt>
                <dd className="mt-1 text-tinta">Sinop e região</dd>
              </div>
            </dl>
          </div>
          <div className="reveal relative lg:col-span-7 lg:mr-[min(-40px,calc(680px_-_50vw))]">
            <EditorialImage photo={EDITORIAL.clearSpan} sizes="(min-width:1024px) 60vw, 100vw" className="aspect-[4/3] w-full sm:aspect-[16/11]" labelPosition="bottom-right" />
          </div>
        </div>
      </section>

      {/* ═════════════ Estruturas: quadro técnico com a planta de cada tenda em escala ═════════════ */}
      <section id="estruturas" className="scroll-mt-16 bg-lona py-24 sm:py-36" aria-labelledby="estruturas-titulo">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <h2 id="estruturas-titulo" className="reveal text-[34px] font-semibold leading-[1.02] tracking-[-0.035em] text-tinta [text-wrap:balance] sm:text-[48px] lg:col-span-7 lg:text-[64px]">
              Estruturas para locação.
            </h2>
            <p className="reveal max-w-md text-[16px] leading-relaxed text-tinta/65 lg:col-span-4 lg:col-start-9">
              Cada planta abaixo está desenhada na mesma escala: compare o tamanho real das coberturas e escolha a que cabe no seu evento.
            </p>
          </div>

          <div className="mt-14 grid gap-10 lg:mt-20 lg:grid-cols-12 lg:gap-10">
            {/* Foto real do catálogo (ou ilustrativa), fixa enquanto a lista rola */}
            <figure className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                {catalogPhoto ? (
                  <Link href={productPath(catalogPhoto.p)} className="group block overflow-hidden bg-sand">
                    <div className="aspect-[4/5] overflow-hidden">
                      <Photo id={catalogPhoto.id} alt={catalogPhoto.p.name} sizes="(min-width:1024px) 40vw, 100vw" className="transition-transform duration-[1.6s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]" />
                    </div>
                  </Link>
                ) : (
                  <EditorialImage photo={EDITORIAL.clearSpan} sizes="(min-width:1024px) 40vw, 100vw" className="aspect-[4/5]" />
                )}
                <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-[13px] text-tinta/65">
                  {catalogPhoto ? (
                    <>
                      <span>Foto real: {catalogPhoto.p.name}</span>
                      <Link href={productPath(catalogPhoto.p)} className="text-tinta underline decoration-brand underline-offset-4">Ver detalhes</Link>
                    </>
                  ) : (
                    <span>Estrutura retangular para grandes eventos</span>
                  )}
                </figcaption>
              </div>
            </figure>

            <div className="lg:col-span-7">
              {tents.length ? (
                <>
                  <div className="hidden grid-cols-[100px_minmax(0,1fr)_96px_140px_auto] gap-x-6 border-b border-tinta/20 pb-3 text-[12.5px] text-tinta/65 md:grid">
                    <span>Planta</span>
                    <span>Estrutura</span>
                    <span>Área</span>
                    <span className="text-right">Valor por dia</span>
                    <span className="w-[124px]" />
                  </div>
                  <ul>
                    {tents.map(({ p, dim }) => (
                      <ScheduleRow key={p.id} p={p} footprint={<Footprint w={dim!.w} d={dim!.d} maxSide={maxSide} className="h-[76px] w-[76px] text-tinta md:h-[88px] md:w-[88px]" />} area={areaLabel(dim!.area)} />
                    ))}
                  </ul>
                </>
              ) : null}

              {others.length ? (
                <div className={tents.length ? "mt-14" : ""}>
                  <h3 className="border-b border-tinta/20 pb-3 text-[15px] font-semibold text-tinta">{tents.length ? "Equipamentos e outras estruturas" : "Estruturas"}</h3>
                  <ul>
                    {others.map(({ p }) => (
                      <ScheduleRow key={p.id} p={p} />
                    ))}
                  </ul>
                </div>
              ) : null}

              {!products.length ? (
                <p className="border-t border-tinta/15 pt-8 text-[17px] text-tinta/65">
                  O catálogo está sendo preparado. Para consultar as estruturas disponíveis, fale com a nossa equipe pelo WhatsApp.
                </p>
              ) : null}

              <Link href="/tendas" className="group/link mt-10 inline-flex items-center gap-2 text-[15px] font-medium text-tinta underline decoration-brand decoration-[1.5px] underline-offset-[7px]">
                Ver o catálogo completo com fotos
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════ Aplicações: composição assimétrica de fotografias grandes ═════════════ */}
      <section id="aplicacoes" className="scroll-mt-16 bg-white py-24 sm:py-36" aria-labelledby="aplicacoes-titulo">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
          <h2 id="aplicacoes-titulo" className="reveal max-w-[16ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.035em] text-tinta [text-wrap:balance] sm:text-[48px] lg:text-[64px]">
            Uma estrutura para cada tipo de evento.
          </h2>
          <div className="mt-16 grid gap-x-10 gap-y-16 sm:mt-20 lg:grid-cols-12 lg:gap-y-24">
            <Application item={APPLICATIONS[0]} className="lg:col-span-7" aspect="aspect-[4/3] lg:aspect-[5/4]" sizes="(min-width:1024px) 56vw, 100vw" />
            <Application item={APPLICATIONS[1]} className="lg:col-span-4 lg:col-start-9 lg:mt-40" aspect="aspect-[4/5]" sizes="(min-width:1024px) 32vw, 100vw" />
            <Application item={APPLICATIONS[2]} className="lg:col-span-6 lg:col-start-2" aspect="aspect-[4/3]" sizes="(min-width:1024px) 40vw, 100vw" />
            <Application item={APPLICATIONS[3]} className="lg:col-span-4 lg:col-start-9 lg:mt-56" aspect="aspect-[4/5]" sizes="(min-width:1024px) 40vw, 100vw" />
          </div>
        </div>
      </section>

      {/* ═════════════ Diferenciais: estrutura é engenharia ═════════════ */}
      <section className="relative isolate overflow-hidden bg-abismo text-white" aria-labelledby="diferenciais-titulo">
        <div className="grid lg:grid-cols-2">
          <EditorialImage photo={EDITORIAL.structure} sizes="(min-width:1024px) 50vw, 100vw" className="aspect-[4/3] lg:aspect-auto lg:min-h-[760px]" labelPosition="bottom-left" />
          <div className="px-5 py-20 sm:px-8 sm:py-28 lg:px-16 xl:px-24">
            <h2 id="diferenciais-titulo" className="reveal max-w-[14ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.035em] [text-wrap:balance] sm:text-[48px] lg:text-[56px]">
              Do pedido à desmontagem, a mesma equipe.
            </h2>
            <dl className="mt-14 border-t border-white/15">
              {DIFFERENTIALS.map(([title, text], i) => (
                <div key={title} className="reveal grid gap-2 border-b border-white/15 py-6 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-8" style={{ transitionDelay: `${i * 70}ms` }}>
                  <dt className="text-[18px] font-semibold tracking-[-0.01em]">{title}</dt>
                  <dd className="text-[15.5px] leading-relaxed text-white/65">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ═════════════ Processo: sequência da contratação ═════════════ */}
      <section id="processo" className="scroll-mt-16 bg-lona py-24 sm:py-36" aria-labelledby="processo-titulo">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <h2 id="processo-titulo" className="reveal text-[34px] font-semibold leading-[1.02] tracking-[-0.035em] text-tinta sm:text-[48px] lg:col-span-7 lg:text-[64px]">
              Como funciona a locação.
            </h2>
            <div className="reveal lg:col-span-4 lg:col-start-9 lg:justify-self-end">
              <Link href={QUOTE_HREF} className="group/btn inline-flex h-[52px] items-center gap-3 rounded-[3px] bg-tinta px-7 text-[15px] font-semibold text-white transition-colors duration-300 hover:bg-brand-logo">
                Começar meu pedido
                <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover/btn:translate-x-1" />
              </Link>
            </div>
          </div>
          <ol className="mt-16 grid border-t border-tinta/20 sm:mt-20 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className={`reveal border-b border-tinta/20 py-8 md:px-6 lg:border-b-0 lg:py-10 ${i > 0 ? "lg:border-l" : "lg:pl-0"} ${i % 2 === 1 ? "md:border-l lg:border-l" : "md:pl-0"}`} style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="block text-[64px] font-light leading-none tracking-[-0.04em] text-aco tabular sm:text-[88px]">{i + 1}</span>
                <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.01em] text-tinta">{title}</h3>
                <p className="mt-2.5 max-w-[28ch] text-[15.5px] leading-relaxed text-tinta/65">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═════════════ Fotos reais (aparece com 3 fotos ou mais cadastradas) ═════════════ */}
      {allPhotos.length >= 3 ? (
        <section id="galeria" className="scroll-mt-16 bg-white py-24 sm:py-36" aria-labelledby="galeria-titulo">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
            <div className="reveal mb-12 flex flex-wrap items-end justify-between gap-6">
              <h2 id="galeria-titulo" className="text-[34px] font-semibold leading-[1.02] tracking-[-0.035em] text-tinta sm:text-[48px]">
                Nossas estruturas montadas.
              </h2>
              <p className="max-w-sm text-[15px] text-tinta/65">Fotos reais das estruturas da {settings.companyName}. Toque em uma imagem para ampliar.</p>
            </div>
            <HomeGallery items={allPhotos.slice(0, 10)} />
          </div>
        </section>
      ) : null}

      {/* ═════════════ Chamada final ═════════════ */}
      <section id="contato" className="relative isolate scroll-mt-16 overflow-hidden bg-abismo text-white" aria-labelledby="cta-titulo">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <EditorialImage photo={EDITORIAL.reception} sizes="100vw" decorative label={false} className="h-full w-full" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,20,40,0.94)_0%,rgba(7,20,40,0.78)_45%,rgba(7,20,40,0.35)_100%)]" />
        </div>
        <div className="mx-auto grid min-h-[86svh] max-w-[1440px] gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-12 lg:items-end lg:px-10">
          <div className="reveal lg:col-span-7">
            <h2 id="cta-titulo" className="text-[clamp(36px,6.4vw,104px)] font-semibold uppercase leading-[0.92] tracking-[-0.04em] [text-wrap:balance]">
              Seu evento merece uma estrutura à altura.
            </h2>
            <p className="mt-8 max-w-lg text-[17px] leading-relaxed text-white/75 sm:text-[19px]">
              Conte com a {settings.companyName} para encontrar a estrutura ideal para o seu evento.
            </p>
          </div>
          <div className="reveal lg:col-span-5">
            <TitleBlock
              rows={[
                ...(settings.whatsappNumber && wa ? ([["WhatsApp", formatPhoneDisplay(settings.whatsappNumber)]] as [string, string][]) : []),
                ...(settings.phones ? ([["Telefone", settings.phones.split("·")[0].trim()]] as [string, string][]) : []),
                ["Endereço", `${settings.address ? `${settings.address}, ` : ""}${settings.city}`],
                ...(ig ? ([["Instagram", settings.instagram ?? ""]] as [string, string][]) : []),
              ]}
              wa={wa}
              waLabel="Fale com nossa equipe"
              mapHref={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
            />
            <p className="mt-3 text-[11.5px] text-white/55">Imagem de fundo ilustrativa</p>
          </div>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </>
  );
}

/**
 * Carimbo de prancha técnica: o bloco de identificação do desenho de arquitetura, aqui com
 * os dados reais da empresa e as duas ações (orçamento online e WhatsApp).
 */
function TitleBlock({ rows, wa, waLabel = "Falar no WhatsApp", mapHref, compactOnMobile = false }: { rows: [string, string][]; wa: string | null; waLabel?: string; mapHref?: string; compactOnMobile?: boolean }) {
  const info = compactOnMobile ? "hidden sm:grid" : "grid";
  return (
    <div className="bg-white text-tinta shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]">
      <div className={`${info} grid-cols-[1fr_auto] items-center gap-4 border-b border-tinta/15 px-5 py-4`}>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Universo Tendas</span>
        <span className="text-[12.5px] text-tinta/65">Locação de estruturas para eventos</span>
      </div>
      <dl className={`${info} grid-cols-2`}>
        {rows.map(([k, v], i) => (
          <div key={k} className={`border-b border-tinta/15 px-5 py-3.5 ${i % 2 === 0 ? "border-r" : ""}`}>
            <dt className="text-[12px] text-tinta/65">{k}</dt>
            <dd className="mt-0.5 text-[14.5px] font-medium">
              {k === "Endereço" && mapHref ? (
                <a href={mapHref} target="_blank" rel="noopener noreferrer" className="underline decoration-brand decoration-[1.5px] underline-offset-[3px]">
                  {v}
                </a>
              ) : (
                v
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid sm:grid-cols-[1.2fr_1fr]">
        <Link href={QUOTE_HREF} className="group/btn flex h-16 items-center justify-between gap-3 bg-brand-logo px-5 text-[16px] font-semibold text-white transition-colors duration-300 hover:bg-brand-soft">
          Solicitar orçamento
          <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover/btn:translate-x-1" />
        </Link>
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-16 items-center gap-3 px-5 text-[15px] font-medium text-tinta transition-colors duration-300 hover:bg-lona">
            <WhatsAppIcon className="h-5 w-5 text-[#1fa855]" />
            {waLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** Linha do quadro técnico: planta em escala (tendas), nome, área, valor por dia e orçamento direto. */
function ScheduleRow({ p, footprint, area }: { p: Product; footprint?: React.ReactNode; area?: string }) {
  const price = p.rentalPriceCents != null ? money(p.rentalPriceCents) : null;
  return (
    <li className="group relative border-b border-tinta/12 transition-colors duration-500 hover:bg-white">
      <div className={`grid items-center gap-x-5 gap-y-3 py-4 md:gap-x-6 ${footprint ? "grid-cols-[76px_minmax(0,1fr)_auto] md:grid-cols-[100px_minmax(0,1fr)_96px_140px_auto]" : "grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_140px_auto]"}`}>
        {footprint ? <div className="row-span-2 md:row-span-1">{footprint}</div> : null}
        <div className="min-w-0">
          <Link href={productPath(p)} className="text-[19px] font-semibold tracking-[-0.015em] text-tinta after:absolute after:inset-0 sm:text-[21px]">
            {p.name}
          </Link>
          <p className="mt-0.5 text-[13px] text-tinta/65">
            {p.category}
            {area ? <span className="md:hidden">{` · ${area}`}</span> : null}
          </p>
        </div>
        {footprint ? <span className="hidden text-[16px] tabular text-tinta/80 md:block">{area}</span> : null}
        <p className="text-right">
          {price ? (
            <>
              <span className="block text-[17px] font-semibold tabular text-tinta">{price}</span>
              <span className="text-[12px] text-tinta/65">por dia</span>
            </>
          ) : (
            <span className="text-[14px] text-tinta/65">Valor a consultar</span>
          )}
        </p>
        <Link
          href={`${QUOTE_HREF}?tenda=${p.slug ?? p.id}`}
          className={`relative z-10 inline-flex h-10 w-fit items-center gap-2 rounded-[3px] border border-tinta/25 px-4 text-[14px] font-medium text-tinta transition-colors duration-300 hover:border-brand-logo hover:bg-brand-logo hover:text-white md:w-[124px] md:justify-center ${footprint ? "col-start-2 col-span-2 md:col-span-1 md:col-start-auto" : "col-span-2 md:col-span-1"}`}
        >
          Orçamento
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

function Application({
  item,
  className,
  aspect,
  sizes,
}: {
  item: (typeof APPLICATIONS)[number];
  className: string;
  aspect: string;
  sizes: string;
}) {
  return (
    <figure className={`reveal group ${className}`}>
      <div className="overflow-hidden">
        <EditorialImage
          photo={item.photo}
          sizes={sizes}
          className={aspect}
          imgClassName="transition-transform duration-[1.8s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />
      </div>
      <figcaption className="mt-5 grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-6">
        <h3 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-tinta sm:text-[26px]">{item.title}</h3>
        <p className="text-[15.5px] leading-relaxed text-tinta/65">{item.text}</p>
      </figcaption>
    </figure>
  );
}
