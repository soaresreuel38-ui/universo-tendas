import type { Metadata } from "next";
import Link from "next/link";
import { TentDrawing } from "@/components/brand/TentDrawing";
import { HomeGallery, type GalleryItem } from "@/components/site/HomeGallery";
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

/** Diferenciais reais do serviço (nada de números, prêmios ou clientes inventados). */
const DIFFERENTIALS = [
  ["Montagem e desmontagem", "Nossa equipe leva a estrutura, monta no endereço do evento e retira depois."],
  ["Disponibilidade na hora", "Pelo site, você vê quantas unidades estão livres para a data do seu evento."],
  ["Atendimento direto", "Do primeiro contato à confirmação, você fala com a nossa equipe pelo WhatsApp."],
  ["Reserva acompanhada", "Cada pedido tem número, contrato e acompanhamento online, sem precisar de cadastro."],
] as const;

type PublicProducts = Awaited<ReturnType<typeof listPublicProducts>>;

export default async function HomePage() {
  const [settings, products] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);

  // Somente fotos reais cadastradas no painel. Capa: 1ª foto do 1º produto em "Destaque" (ou do 1º com foto).
  const withPhotos = products.filter((p) => productPhotos(p).length);
  const cover = withPhotos.find((p) => p.featured) ?? withPhotos[0] ?? null;
  const coverPhoto = cover ? productPhotos(cover)[0] : null;
  // Foto grande o bastante para tela cheia? (lida do próprio arquivo)
  const coverSize = coverPhoto ? await photoSize(coverPhoto) : null;
  const fullBleed = Boolean(coverSize && coverSize.width >= 1400);

  const allPhotos: GalleryItem[] = withPhotos.flatMap((p) => productPhotos(p).map((id) => ({ id, name: p.name, path: productPath(p) })));
  const aboutPhoto = allPhotos.find((x) => x.id !== coverPhoto) ?? allPhotos[0] ?? null;
  const ctaPhoto = allPhotos.find((x) => x.id !== coverPhoto && x.id !== aboutPhoto?.id) ?? null;
  const shown = [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 5);

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

      {/* ───────────── 1. Capa ───────────── */}
      <section className="relative isolate flex min-h-[calc(100svh-72px)] flex-col overflow-hidden bg-coal text-white">
        {fullBleed && coverPhoto && cover ? (
          // Foto grande: fotografia de campanha em tela cheia, overlay para leitura sem esconder a tenda.
          <div className="absolute inset-0 -z-10" aria-hidden>
            <div className="h-full w-full animate-slow-zoom">
              <Photo id={coverPhoto} alt="" priority sizes="100vw" />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,9,11,0.82)_0%,rgba(8,9,11,0.5)_45%,rgba(8,9,11,0.15)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(0deg,rgba(8,9,11,0.85),transparent)]" />
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col justify-start px-5 pt-16 sm:px-8 lg:justify-center lg:pt-0">
          <p className={`${ui.kicker} animate-rise`}>Universo Tendas · {settings.city}</p>
          <h1 className="mt-6 max-w-[14ch] animate-rise text-[40px] font-semibold uppercase leading-[0.98] tracking-[-0.025em] [animation-delay:80ms] [text-wrap:balance] sm:text-[60px] lg:text-[80px] xl:text-[92px]">
            Estruturas que transformam eventos em experiências.
          </h1>
          <p className="mt-7 max-w-[34rem] animate-rise text-[17px] leading-relaxed text-white/75 [animation-delay:140ms] sm:text-[19px]">
            Locação de tendas e estruturas para eventos com qualidade, segurança e excelência em cada detalhe.
          </p>
          <div className="mt-10 flex animate-rise flex-col gap-3 [animation-delay:200ms] sm:flex-row">
            <Link href={QUOTE_HREF} className={ui.btnGold}>
              Solicitar orçamento
              <span aria-hidden className="transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
            </Link>
            <a href="#estruturas" className={ui.btnGhostLight}>
              Conhecer nossas estruturas
            </a>
          </div>
        </div>

        {!fullBleed ? (
          // Foto de catálogo (recorte de fundo claro, resolução menor): a tenda "iluminada" sobre o fundo escuro.
          // A luz e a foto ficam na MESMA camada para o fundo branco do recorte se fundir à luz (multiply).
          // Celular: abaixo dos botões, sem ficar atrás do texto. Telas grandes: composição à direita.
          <div
            aria-hidden
            className="pointer-events-none relative mt-6 flex justify-center bg-[radial-gradient(ellipse_75%_58%_at_50%_55%,#e9e6e0_0%,#bdb8ae_34%,#3a3a38_66%,#0c0e11_92%)] px-4 py-10 lg:absolute lg:inset-0 lg:-z-10 lg:mt-0 lg:items-center lg:justify-end lg:bg-[linear-gradient(90deg,rgba(12,14,17,1)_0%,rgba(12,14,17,0.94)_30%,rgba(12,14,17,0.35)_52%,transparent_66%),radial-gradient(ellipse_44%_64%_at_72%_56%,#ece9e3_0%,#c2bdb3_36%,#3b3b39_68%,#0c0e11_92%)] lg:px-0 lg:py-0 lg:pr-[5%] lg:pt-[4%]"
          >
            {coverPhoto ? (
              <div className="animate-slow-zoom mix-blend-multiply">
                <Photo id={coverPhoto} alt="" priority sizes="(min-width: 1024px) 46vw, 100vw" className="h-auto! w-[86vw]! max-w-[500px] bg-transparent! object-contain! lg:w-[min(44vw,760px)]! lg:max-w-none" />
              </div>
            ) : (
              <TentDrawing strokeWidth={0.6} className="w-[86%] max-w-[560px] text-night/35 lg:w-[44%] lg:max-w-[760px]" />
            )}
          </div>
        ) : null}

        {/* Faixa inferior com informações reais da empresa */}
        <div className="relative mt-12 border-t border-white/10 lg:mt-0">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-5 text-[13px] text-white/60 sm:px-8">
            <ul className="flex flex-wrap gap-x-7 gap-y-2">
              {["Sinop e região", "Montagem e desmontagem", "Disponibilidade consultada na hora"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span aria-hidden className="h-1 w-1 bg-gold" />
                  {t}
                </li>
              ))}
            </ul>
            {cover ? (
              <Link href={productPath(cover)} className="hidden text-white/45 transition-colors hover:text-white lg:inline">
                Na imagem: {cover.name}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* ───────────── 2. Estruturas ───────────── */}
      <section id="estruturas" className="scroll-mt-20 bg-linen py-24 sm:py-32" aria-labelledby="estruturas-titulo">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
          <div className="reveal grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className={ui.kicker}>Estruturas para locação</p>
              <h2 id="estruturas-titulo" className={`${ui.h2} mt-4 max-w-[18ch] [text-wrap:balance]`}>Uma estrutura para cada formato de evento.</h2>
            </div>
            <Link href="/tendas" className={ui.link}>
              Ver o catálogo completo →
            </Link>
          </div>

          {shown.length ? (
            <div className="mt-16 space-y-24 sm:space-y-32">
              {shown.map((p, i) => (
                <StructureRow key={p.id} p={p} index={i} />
              ))}
            </div>
          ) : (
            <p className="mt-14 max-w-xl border-t border-night/10 pt-8 text-[17px] text-night/65">
              O catálogo está sendo preparado. Para consultar as estruturas disponíveis, fale com a nossa equipe pelo WhatsApp.
            </p>
          )}
        </div>
      </section>

      {/* ───────────── 3. A empresa ───────────── */}
      <section id="empresa" className="scroll-mt-20 bg-white py-24 sm:py-32" aria-labelledby="empresa-titulo">
        <div className="mx-auto grid max-w-[1360px] gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-10">
          <div className="reveal lg:col-span-6 lg:pr-10">
            <p className={ui.kicker}>A empresa</p>
            <h2 id="empresa-titulo" className={`${ui.h2} mt-4 [text-wrap:balance]`}>Estrutura, experiência e confiança em cada projeto.</h2>
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
                <dt className="text-[12px] uppercase tracking-[0.18em] text-night/45">Onde estamos</dt>
                <dd className="mt-1.5 text-[16px] text-night">
                  {settings.address ? `${settings.address}, ` : ""}
                  {settings.city}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-[0.18em] text-night/45">Atendimento</dt>
                <dd className="mt-1.5 text-[16px] text-night">Sinop e região</dd>
              </div>
            </dl>
          </div>
          <figure className="reveal relative lg:col-span-6">
            <span aria-hidden className="absolute -left-3 -top-3 hidden h-24 w-24 border-l border-t border-gold lg:block" />
            <div className="relative aspect-[5/4] overflow-hidden bg-linen">
              {aboutPhoto ? (
                <Photo id={aboutPhoto.id} alt={aboutPhoto.name} sizes="(min-width: 1024px) 50vw, 100vw" />
              ) : (
                <div className="flex h-full items-center justify-center" aria-hidden>
                  <TentDrawing variant="articulada" strokeWidth={0.8} className="w-[70%] text-night/20" />
                </div>
              )}
            </div>
            {aboutPhoto ? <figcaption className="mt-3 text-[13px] text-night/45">{aboutPhoto.name}</figcaption> : null}
          </figure>
        </div>
      </section>

      {/* ───────────── 4. Galeria (só com fotos reais suficientes) ───────────── */}
      {allPhotos.length >= 3 ? (
        <section id="galeria" className="scroll-mt-20 bg-coal py-24 text-white sm:py-32" aria-labelledby="galeria-titulo">
          <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
            <div className="reveal mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className={ui.kicker}>Galeria</p>
                <h2 id="galeria-titulo" className="mt-4 text-[28px] font-semibold tracking-[-0.025em] sm:text-[38px] lg:text-[44px]">
                  Nossas estruturas.
                </h2>
              </div>
              <p className="max-w-sm text-[15px] text-white/55">Fotos das estruturas da Universo Tendas. Toque em uma imagem para ampliar.</p>
            </div>
            <HomeGallery items={allPhotos.slice(0, 10)} />
          </div>
        </section>
      ) : null}

      {/* ───────────── 5. Diferenciais ───────────── */}
      <section className="bg-linen py-24 sm:py-32" aria-labelledby="diferenciais-titulo">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
          <div className="reveal max-w-2xl">
            <p className={ui.kicker}>Diferenciais</p>
            <h2 id="diferenciais-titulo" className={`${ui.h2} mt-4 [text-wrap:balance]`}>Do pedido à desmontagem, tudo com a mesma equipe.</h2>
          </div>
          <ol className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {DIFFERENTIALS.map(([title, text], i) => (
              <li key={title} className="reveal border-t border-night/15 pt-6" style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="block text-[13px] font-semibold tabular tracking-[0.12em] text-gold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.01em] text-night">{title}</h3>
                <p className="mt-2.5 text-[15.5px] leading-relaxed text-night/65">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── 6. Chamada para orçamento ───────────── */}
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
            <span aria-hidden className="block h-px w-16 bg-gold" />
            <h2 id="cta-titulo" className="mt-8 text-[34px] font-semibold uppercase leading-[1.02] tracking-[-0.02em] [text-wrap:balance] sm:text-[52px] lg:text-[64px]">
              Seu evento merece uma estrutura à altura.
            </h2>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/70 sm:text-[19px]">
              Conte com a {settings.companyName} para encontrar a estrutura ideal para o seu evento.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={ui.btnGold}>
                  Fale com nossa equipe
                  <span aria-hidden className="transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
                </a>
              ) : null}
              <Link href={QUOTE_HREF} className={ui.btnGhostLight}>
                Solicitar orçamento online
              </Link>
            </div>
          </div>
          <dl className="reveal grid gap-6 border-t border-white/10 pt-8 text-[15px] sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {settings.whatsappNumber && wa ? (
              <ContactItem label="WhatsApp">
                <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                  {formatPhoneDisplay(settings.whatsappNumber)}
                </a>
              </ContactItem>
            ) : null}
            {settings.phones ? <ContactItem label="Telefone">{settings.phones.split("·")[0].trim()}</ContactItem> : null}
            <ContactItem label="Endereço">
              {settings.address ? `${settings.address} · ` : ""}
              {settings.city}{" "}
              <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold">
                mapa
              </a>
            </ContactItem>
            {ig ? (
              <ContactItem label="Instagram">
                <a href={ig} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
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

/** Estrutura em destaque: fotografia grande e texto ao lado, alternando o lado a cada item. */
function StructureRow({ p, index }: { p: PublicProducts[number]; index: number }) {
  const photo = productPhotos(p)[0];
  const flip = index % 2 === 1;
  const lead = index === 0;
  return (
    <article className="reveal grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
      <Link
        href={productPath(p)}
        className={`group -mx-5 block overflow-hidden bg-white sm:mx-0 ${lead ? "lg:col-span-8" : "lg:col-span-7"} ${flip ? "lg:order-2 lg:col-start-6" : ""}`}
        aria-label={p.name}
      >
        <div className="aspect-[4/3]">
          <Photo
            id={photo}
            alt={p.name}
            className="transition-transform duration-[1.4s] ease-out group-hover:scale-[1.03]"
            sizes="(min-width: 1024px) 60vw, 100vw"
          />
        </div>
      </Link>
      <div className={`${lead ? "lg:col-span-4" : "lg:col-span-5"} ${flip ? "lg:order-1 lg:col-start-1 lg:row-start-1" : ""}`}>
        <p className="text-[13px] font-medium tabular tracking-[0.12em] text-gold">
          {String(index + 1).padStart(2, "0")}
          <span className="ml-3 tracking-normal text-night/50">
            {p.category}
            {p.dimensions ? ` · ${p.dimensions}` : ""}
          </span>
        </p>
        <h3 className="mt-4 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-night sm:text-[34px]">
          <Link href={productPath(p)} className="transition-colors hover:text-night/70">
            {p.name}
          </Link>
        </h3>
        {p.description ? <p className="mt-4 line-clamp-4 text-[16px] leading-relaxed text-night/65">{p.description}</p> : null}
        <p className="mt-5 text-[16px] text-night">
          {p.rentalPriceCents != null ? (
            <>
              <span className="font-semibold">{money(p.rentalPriceCents)}</span> <span className="text-night/50">por dia</span>
            </>
          ) : (
            <span className="text-night/60">Valor a consultar</span>
          )}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
          <Link href={`${QUOTE_HREF}?tenda=${p.slug ?? p.id}`} className={ui.btnPrimary}>
            Solicitar orçamento
          </Link>
          <Link href={productPath(p)} className={ui.link}>
            Ver detalhes
          </Link>
        </div>
      </div>
    </article>
  );
}

function ContactItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">{label}</dt>
      <dd className="mt-1.5 text-white/85">{children}</dd>
    </div>
  );
}
