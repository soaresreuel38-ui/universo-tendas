import type { Metadata } from "next";
import Link from "next/link";
import { TentDrawing } from "@/components/brand/TentDrawing";
import { HomeGallery, type GalleryItem } from "@/components/site/HomeGallery";
import { ArrowRight, ArrowUpRight, WhatsAppIcon } from "@/components/site/Icons";
import { Photo } from "@/components/site/Photo";
import { QUOTE_HREF, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { ui } from "@/components/site/ui";
import { formatPhoneDisplay } from "@/lib/br-documents";
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

/** Tipos de evento atendidos (confirmados pela empresa). */
const EVENT_TYPES = [
  ["Casamentos e festas", "Casamentos, aniversários, formaturas e festas particulares."],
  ["Eventos corporativos", "Lançamentos, confraternizações e eventos de empresas."],
  ["Agro e feiras", "Dias de campo, feiras agropecuárias, leilões e exposições."],
  ["Eventos públicos", "Shows, eventos municipais, igrejas, esportes e comércio."],
] as const;

/** Como a locação funciona de fato no sistema (pedido online → aprovação da equipe → contrato → montagem). */
const STEPS = [
  ["Escolha a estrutura e as datas", "No site você vê, na hora, quantas unidades estão livres para os dias do seu evento."],
  ["Envie o pedido", "Pelo site ou pelo WhatsApp. Cada pedido recebe um número para acompanhar online, sem cadastro."],
  ["Confirmação e contrato", "Nossa equipe analisa, confirma a reserva e envia o contrato."],
  ["Montagem e retirada", "Levamos a estrutura, montamos no endereço do evento e retiramos depois."],
] as const;

type PublicProducts = Awaited<ReturnType<typeof listPublicProducts>>;
type Product = PublicProducts[number];

/** Fotos pequenas (recortes de catálogo) aparecem inteiras sobre fundo claro; fotos grandes preenchem o quadro. */
const SMALL_PHOTO = 900;

export default async function HomePage() {
  const [settings, products] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);

  // Somente fotos reais cadastradas no painel. Capa: 1ª foto do 1º produto em "Destaque" (ou do 1º com foto).
  const withPhotos = products.filter((p) => productPhotos(p).length);
  const cover = withPhotos.find((p) => p.featured) ?? withPhotos[0] ?? null;
  const coverPhoto = cover ? productPhotos(cover)[0] : null;

  // Estruturas com foto ganham destaque grande; as demais entram na lista de preços (nunca um quadro vazio).
  const pictured = [...withPhotos].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 3);
  const listed = products.filter((p) => !pictured.includes(p));

  const allPhotos: GalleryItem[] = withPhotos.flatMap((p) => productPhotos(p).map((id) => ({ id, name: p.name, path: productPath(p) })));
  const aboutPhoto = allPhotos.find((x) => x.id !== coverPhoto) ?? allPhotos[0] ?? null;
  const ctaPhoto = allPhotos.find((x) => x.id !== coverPhoto && x.id !== aboutPhoto?.id) ?? null;

  // Tamanho real das fotos (lido do arquivo) para decidir tela cheia / quadro inteiro.
  const sizeIds = [...new Set([coverPhoto, aboutPhoto?.id, ...pictured.map((p) => productPhotos(p)[0])].filter(Boolean) as string[])];
  const sizes = new Map(await Promise.all(sizeIds.map(async (id) => [id, await photoSize(id)] as const)));
  const isSmall = (id: string | null | undefined) => {
    const s = id ? sizes.get(id) : null;
    return Boolean(s && s.width < SMALL_PHOTO);
  };
  const coverSize = coverPhoto ? sizes.get(coverPhoto) : null;
  const fullBleed = Boolean(coverSize && coverSize.width >= 1200);

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
      <SiteHeader />

      {/* ───────────── Capa ───────────── */}
      <section className="relative isolate flex min-h-[calc(100svh-72px)] flex-col overflow-hidden bg-coal text-white">
        {fullBleed && coverPhoto && cover ? (
          // Foto grande: fotografia em tela cheia, escurecida só onde o texto precisa de leitura.
          <div className="absolute inset-0 -z-10" aria-hidden>
            <div className="h-full w-full animate-slow-zoom">
              <Photo id={coverPhoto} alt="" priority sizes="100vw" />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,9,11,0.86)_0%,rgba(8,9,11,0.55)_42%,rgba(8,9,11,0.12)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-[linear-gradient(0deg,rgba(8,9,11,0.92)_0%,rgba(8,9,11,0.35)_45%,transparent)]" />
            <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(8,9,11,0.55),transparent)]" />
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col justify-end px-5 pb-14 pt-20 sm:px-8 lg:pb-20">
          <h1 className="max-w-[13ch] animate-rise text-[42px] font-semibold uppercase leading-[0.95] tracking-[-0.03em] [text-wrap:balance] sm:text-[64px] lg:text-[84px] xl:text-[96px]">
            Estruturas que elevam o padrão do seu evento.
          </h1>
          <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,34rem)_auto] lg:items-end lg:justify-between">
            <p className="animate-rise text-[17px] leading-relaxed text-white/80 [animation-delay:90ms] sm:text-[19px]">
              Locação de tendas e estruturas para eventos com qualidade, segurança e excelência em cada projeto.
            </p>
            <div className="flex animate-rise flex-col gap-3 [animation-delay:160ms] sm:flex-row">
              <Link href={QUOTE_HREF} className={`${ui.btnGold} rounded-md`}>
                Solicitar orçamento
                <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 ease-out group-hover/btn:translate-x-1" />
              </Link>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={`${ui.btnGhostLight} rounded-md`}>
                  <WhatsAppIcon />
                  Falar no WhatsApp
                </a>
              ) : (
                <a href="#estruturas" className={`${ui.btnGhostLight} rounded-md`}>
                  Conhecer nossas estruturas
                </a>
              )}
            </div>
          </div>
        </div>

        {!fullBleed ? (
          // Foto de catálogo (recorte de fundo claro, resolução menor): a tenda "iluminada" sobre o fundo escuro.
          // A luz e a foto ficam na MESMA camada para o fundo branco do recorte se fundir à luz (multiply).
          <div
            aria-hidden
            className="pointer-events-none relative -mt-4 flex justify-center bg-[radial-gradient(ellipse_75%_58%_at_50%_55%,#e9e6e0_0%,#bdb8ae_34%,#3a3a38_66%,#0c0e11_92%)] px-4 py-10 lg:absolute lg:inset-0 lg:-z-10 lg:mt-0 lg:items-center lg:justify-end lg:bg-[linear-gradient(90deg,rgba(12,14,17,1)_0%,rgba(12,14,17,0.94)_30%,rgba(12,14,17,0.35)_52%,transparent_66%),radial-gradient(ellipse_44%_64%_at_72%_46%,#ece9e3_0%,#c2bdb3_36%,#3b3b39_68%,#0c0e11_92%)] lg:px-0 lg:py-0 lg:pb-[14%] lg:pr-[5%]"
          >
            {coverPhoto ? (
              <div className="animate-slow-zoom mix-blend-multiply">
                <Photo id={coverPhoto} alt="" priority sizes="(min-width: 1024px) 46vw, 100vw" className="h-auto! w-[86vw]! max-w-[500px] bg-transparent! object-contain! lg:w-[min(42vw,720px)]! lg:max-w-none" />
              </div>
            ) : (
              <TentDrawing strokeWidth={0.6} className="w-[86%] max-w-[560px] text-night/35 lg:w-[44%] lg:max-w-[760px]" />
            )}
          </div>
        ) : null}

        {/* Faixa inferior com informações reais da empresa */}
        <div className="relative border-t border-white/12 bg-black/25">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-5 text-[13.5px] text-white/70 sm:px-8">
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {["Sinop e região", "Montagem e desmontagem pela nossa equipe", "Disponibilidade consultada na hora"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {t}
                </li>
              ))}
            </ul>
            {cover ? (
              <Link href={productPath(cover)} className="hidden items-center gap-1.5 text-white/50 transition-colors hover:text-white lg:inline-flex">
                Na imagem: {cover.name}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ───────────── Estruturas ───────────── */}
      <section id="estruturas" className="scroll-mt-20 bg-linen py-24 sm:py-32" aria-labelledby="estruturas-titulo">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
          <div className="reveal grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 id="estruturas-titulo" className={`${ui.h2} max-w-[18ch] [text-wrap:balance]`}>Uma estrutura para cada formato de evento.</h2>
              <p className={`${ui.lead} mt-5 max-w-xl`}>Escolha a estrutura, informe as datas e veja na hora o que está livre para o seu evento.</p>
            </div>
            <Link href="/tendas" className={`${ui.link} group/link`}>
              Ver o catálogo completo
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5" />
            </Link>
          </div>

          {pictured.length ? (
            <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-28">
              {pictured.map((p, i) => (
                <StructureRow key={p.id} p={p} index={i} small={isSmall(productPhotos(p)[0])} />
              ))}
            </div>
          ) : null}

          {listed.length ? (
            <div className={pictured.length ? "mt-24 sm:mt-32" : "mt-14"}>
              <div className="reveal flex flex-wrap items-baseline justify-between gap-4">
                <h3 className="text-[22px] font-semibold tracking-[-0.015em] text-night sm:text-[26px]">
                  {pictured.length ? "Outras estruturas" : "Estruturas para locação"}
                </h3>
                <p className="text-[14px] text-night/55">Valores por dia de evento</p>
              </div>
              <ul className="mt-6 border-b border-night/12">
                {listed.map((p, i) => (
                  <PriceRow key={p.id} p={p} index={i} />
                ))}
              </ul>
            </div>
          ) : null}

          {!products.length ? (
            <p className="mt-14 max-w-xl border-t border-night/10 pt-8 text-[17px] text-night/65">
              O catálogo está sendo preparado. Para consultar as estruturas disponíveis, fale com a nossa equipe pelo WhatsApp.
            </p>
          ) : null}
        </div>
      </section>

      {/* ───────────── A empresa ───────────── */}
      <section id="empresa" className="scroll-mt-20 bg-white py-24 sm:py-32" aria-labelledby="empresa-titulo">
        <div className="mx-auto grid max-w-[1360px] gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="reveal lg:col-span-6 lg:pr-12">
            <h2 id="empresa-titulo" className={`${ui.h2} [text-wrap:balance]`}>Estrutura, experiência e confiança em cada projeto.</h2>
            <div className={`${ui.lead} mt-8 space-y-5`}>
              <p>
                A {settings.companyName} é especializada em locação de tendas e estruturas para eventos em {settings.city} e região — de encontros
                sociais a eventos corporativos.
              </p>
              <p>
                Cada locação é planejada em torno da data e do local do seu evento: a nossa equipe leva a estrutura, faz a montagem e retira depois,
                para que você possa se concentrar no que importa.
              </p>
            </div>
            <dl className="mt-10 grid gap-x-10 gap-y-6 border-t border-night/10 pt-8 sm:grid-cols-2">
              <div>
                <dt className="text-[13px] font-medium text-night/50">Onde estamos</dt>
                <dd className="mt-1.5 text-[16px] text-night">
                  {settings.address ? `${settings.address}, ` : ""}
                  {settings.city}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium text-night/50">Atendimento</dt>
                <dd className="mt-1.5 text-[16px] text-night">Sinop e região</dd>
              </div>
            </dl>
          </div>
          <figure className="reveal lg:col-span-6">
            <div className="relative aspect-[5/4] overflow-hidden rounded-[3px] bg-linen">
              {aboutPhoto ? (
                isSmall(aboutPhoto.id) ? (
                  <div className="flex h-full items-center justify-center bg-white p-[8%] ring-1 ring-inset ring-night/[0.06]">
                    <Photo id={aboutPhoto.id} alt={aboutPhoto.name} sizes="(min-width: 1024px) 40vw, 90vw" className="bg-transparent! object-contain!" />
                  </div>
                ) : (
                  <Photo id={aboutPhoto.id} alt={aboutPhoto.name} sizes="(min-width: 1024px) 50vw, 100vw" />
                )
              ) : (
                <div className="flex h-full items-center justify-center" aria-hidden>
                  <TentDrawing variant="articulada" strokeWidth={0.8} className="w-[70%] text-night/20" />
                </div>
              )}
            </div>
            {aboutPhoto ? <figcaption className="mt-3 text-[13px] text-night/50">{aboutPhoto.name}</figcaption> : null}
          </figure>
        </div>
      </section>

      {/* ───────────── Tipos de evento ───────────── */}
      <section className="relative isolate overflow-hidden bg-coal py-24 text-white sm:py-32" aria-labelledby="eventos-titulo">
        <TentDrawing strokeWidth={0.5} className="pointer-events-none absolute -right-[10%] -top-[8%] -z-10 w-[70%] max-w-[880px] text-white/[0.05]" />
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
          <div className="reveal grid gap-6 lg:grid-cols-12 lg:items-end">
            <h2 id="eventos-titulo" className="text-[28px] font-semibold leading-[1.08] tracking-[-0.025em] [text-wrap:balance] sm:text-[38px] lg:col-span-7 lg:text-[44px]">
              Estruturas para eventos de todos os portes.
            </h2>
            <p className="max-w-md text-[16px] leading-relaxed text-white/65 lg:col-span-5 lg:justify-self-end">
              Da festa em família ao evento da empresa ou da cidade, a estrutura é escolhida de acordo com o espaço e o número de convidados.
            </p>
          </div>
          <ul className="mt-14 grid border-t border-white/12 sm:mt-16 md:grid-cols-2">
            {EVENT_TYPES.map(([title, text], i) => (
              <li
                key={title}
                className={`reveal group flex flex-col gap-3 border-b border-white/12 py-8 transition-colors duration-500 sm:py-10 md:px-8 ${i % 2 === 0 ? "md:border-r md:pl-0" : "md:pr-0"}`}
                style={{ transitionDelay: `${(i % 2) * 90}ms` }}
              >
                <h3 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">{title}</h3>
                <p className="text-[16px] leading-relaxed text-white/60">{text}</p>
              </li>
            ))}
          </ul>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="reveal group/link mt-10 inline-flex items-center gap-2 text-[15px] font-medium text-white underline decoration-brand decoration-[1.5px] underline-offset-[7px] transition-colors hover:text-white/80">
              Conte como será o seu evento
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5" />
            </a>
          ) : null}
        </div>
      </section>

      {/* ───────────── Galeria (só com fotos reais suficientes) ───────────── */}
      {allPhotos.length >= 3 ? (
        <section id="galeria" className="scroll-mt-20 bg-white py-24 sm:py-32" aria-labelledby="galeria-titulo">
          <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
            <div className="reveal mb-12 flex flex-wrap items-end justify-between gap-6">
              <h2 id="galeria-titulo" className={ui.h2}>
                Nossas estruturas.
              </h2>
              <p className="max-w-sm text-[15px] text-night/55">Fotos das estruturas da Universo Tendas. Toque em uma imagem para ampliar.</p>
            </div>
            <HomeGallery items={allPhotos.slice(0, 10)} />
          </div>
        </section>
      ) : null}

      {/* ───────────── Como funciona ───────────── */}
      <section id="como-funciona" className="scroll-mt-20 bg-linen py-24 sm:py-32" aria-labelledby="processo-titulo">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
          <div className="reveal grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <h2 id="processo-titulo" className={`${ui.h2} max-w-[20ch] [text-wrap:balance]`}>Do pedido à desmontagem, tudo com a mesma equipe.</h2>
            <Link href={QUOTE_HREF} className={`${ui.btnPrimary} rounded-md`}>
              Começar meu pedido
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ol className="relative mt-16 grid gap-10 sm:mt-20 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <span aria-hidden className="absolute left-0 right-0 top-[19px] hidden h-px bg-night/12 lg:block" />
            {STEPS.map(([title, text], i) => (
              <li key={title} className="reveal relative" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full border border-brand/50 bg-linen text-[14px] font-semibold tabular text-brand">
                  {i + 1}
                </span>
                <h3 className="mt-6 text-[19px] font-semibold tracking-[-0.01em] text-night">{title}</h3>
                <p className="mt-2.5 max-w-[30ch] text-[15.5px] leading-relaxed text-night/65">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── Chamada para orçamento ───────────── */}
      <section id="contato" className="relative isolate scroll-mt-20 overflow-hidden bg-coal text-white" aria-labelledby="cta-titulo">
        {ctaPhoto ? (
          <div className="absolute inset-0 -z-10" aria-hidden>
            <Photo id={ctaPhoto.id} alt="" sizes="100vw" className="opacity-30" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,14,17,0.96)_0%,rgba(12,14,17,0.75)_60%,rgba(12,14,17,0.55)_100%)]" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <TentDrawing strokeWidth={0.5} className="absolute -bottom-[25%] -right-[8%] w-[80%] max-w-[900px] text-white/[0.06]" />
          </div>
        )}
        <div className="mx-auto grid max-w-[1360px] gap-14 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-12 lg:items-end">
          <div className="reveal lg:col-span-7">
            <span aria-hidden className="block h-px w-16 bg-brand" />
            <h2 id="cta-titulo" className="mt-8 text-[34px] font-semibold uppercase leading-[1] tracking-[-0.025em] [text-wrap:balance] sm:text-[52px] lg:text-[64px]">
              Seu evento merece uma estrutura à altura.
            </h2>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/70 sm:text-[19px]">
              Conte com a {settings.companyName} para encontrar a estrutura ideal para o seu evento.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={`${ui.btnGold} rounded-md`}>
                  <WhatsAppIcon />
                  Fale com nossa equipe
                </a>
              ) : null}
              <Link href={QUOTE_HREF} className={`${ui.btnGhostLight} rounded-md`}>
                Solicitar orçamento online
              </Link>
            </div>
          </div>
          <dl className="reveal grid gap-6 border-t border-white/10 pt-8 text-[15px] sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {settings.whatsappNumber && wa ? (
              <ContactItem label="WhatsApp">
                <a href={wa} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-brand">
                  {formatPhoneDisplay(settings.whatsappNumber)}
                </a>
              </ContactItem>
            ) : null}
            {settings.phones ? <ContactItem label="Telefone">{settings.phones.split("·")[0].trim()}</ContactItem> : null}
            <ContactItem label="Endereço">
              {settings.address ? `${settings.address} · ` : ""}
              {settings.city}{" "}
              <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
                mapa
              </a>
            </ContactItem>
            {ig ? (
              <ContactItem label="Instagram">
                <a href={ig} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-brand">
                  {settings.instagram}
                </a>
              </ContactItem>
            ) : null}
          </dl>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </>
  );
}

function priceLabel(p: Product) {
  return p.rentalPriceCents != null ? money(p.rentalPriceCents) : null;
}

/** Estrutura com foto real: fotografia grande e texto ao lado, alternando o lado a cada item. */
function StructureRow({ p, index, small }: { p: Product; index: number; small: boolean }) {
  const photo = productPhotos(p)[0];
  const flip = index % 2 === 1;
  const lead = index === 0;
  const price = priceLabel(p);
  return (
    <article className="reveal grid items-center gap-8 lg:grid-cols-12 lg:gap-14">
      <Link
        href={productPath(p)}
        className={`group -mx-5 block overflow-hidden sm:mx-0 sm:rounded-[3px] ${small ? "bg-white" : "bg-sand"} ${lead ? "lg:col-span-8" : "lg:col-span-7"} ${flip ? "lg:order-2 lg:col-start-6" : ""}`}
        aria-label={p.name}
      >
        <div className={`aspect-[4/3] ${small ? "flex items-center justify-center p-[7%]" : ""}`}>
          <Photo
            id={photo}
            alt=""
            className={`transition-transform duration-[1.4s] ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:scale-[1.035] ${small ? "bg-transparent! object-contain!" : ""}`}
            sizes="(min-width: 1024px) 60vw, 100vw"
          />
        </div>
      </Link>
      <div className={`${lead ? "lg:col-span-4" : "lg:col-span-5"} ${flip ? "lg:order-1 lg:col-start-1 lg:row-start-1" : ""}`}>
        <p className="text-[13.5px] text-night/55">
          {p.category}
          {p.dimensions ? ` · ${p.dimensions}` : ""}
        </p>
        <h3 className="mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] text-night sm:text-[40px]">
          <Link href={productPath(p)} className="transition-colors hover:text-night/70">
            {p.name}
          </Link>
        </h3>
        {p.description ? <p className="mt-4 line-clamp-4 text-[16px] leading-relaxed text-night/65">{p.description}</p> : null}
        <p className="mt-5 flex items-baseline gap-2 text-night">
          {price ? (
            <>
              <span className="text-[22px] font-semibold tabular tracking-[-0.01em]">{price}</span>
              <span className="text-[14px] text-night/50">por dia</span>
            </>
          ) : (
            <span className="text-[16px] text-night/60">Valor a consultar</span>
          )}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
          <Link href={`${QUOTE_HREF}?tenda=${p.slug ?? p.id}`} className={`${ui.btnPrimary} group/btn rounded-md`}>
            Solicitar orçamento
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
          </Link>
          <Link href={productPath(p)} className={ui.link}>
            Ver detalhes
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Estrutura sem foto: uma linha da lista de preços (nome grande, valor por dia e orçamento direto). */
function PriceRow({ p, index }: { p: Product; index: number }) {
  const price = priceLabel(p);
  return (
    <li className="reveal group relative border-t border-night/12" style={{ transitionDelay: `${Math.min(index, 6) * 50}ms` }}>
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 py-5 transition-[padding] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:py-6 sm:group-hover:pl-3">
        <div className="min-w-0">
          <Link href={productPath(p)} className="text-[19px] font-semibold tracking-[-0.015em] text-night after:absolute after:inset-0 sm:text-[22px]">
            {p.name}
          </Link>
          <p className="mt-0.5 text-[13.5px] text-night/50">
            {p.category}
            {p.dimensions ? ` · ${p.dimensions}` : ""}
          </p>
        </div>
        <p className="col-start-2 row-span-2 text-right sm:col-start-auto sm:row-span-1">
          {price ? (
            <>
              <span className="block text-[17px] font-semibold tabular text-night sm:text-[18px]">{price}</span>
              <span className="text-[12.5px] text-night/50">por dia</span>
            </>
          ) : (
            <span className="text-[14px] text-night/55">Valor a consultar</span>
          )}
        </p>
        <Link
          href={`${QUOTE_HREF}?tenda=${p.slug ?? p.id}`}
          className="relative z-10 col-span-2 mt-3 inline-flex h-10 w-fit items-center gap-2 rounded-md border border-night/20 px-4 text-[14px] font-medium text-night transition-colors duration-300 hover:border-brand hover:bg-brand hover:text-white sm:col-span-1 sm:mt-0"
        >
          Orçamento
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

function ContactItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] font-medium text-white/50">{label}</dt>
      <dd className="mt-1.5 text-white/90">{children}</dd>
    </div>
  );
}
