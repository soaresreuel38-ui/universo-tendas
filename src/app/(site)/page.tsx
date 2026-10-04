import type { Metadata } from "next";
import Link from "next/link";
import { TentDrawing } from "@/components/brand/TentDrawing";
import { Photo } from "@/components/site/Photo";
import { QUOTE_HREF, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { formatPhoneDisplay } from "@/lib/br-documents";
import { whatsappLink } from "@/lib/format";
import { prisma } from "@/server/db";
import { listPublicProducts, productPath, productPhotos } from "@/server/public-booking";
import { getSiteSettings, instagramUrl } from "@/server/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Universo Tendas | Locação de Tendas em Sinop - MT" },
  description: "Locação de tendas e estruturas para eventos, empresas e grandes projetos em Sinop e região. Montagem e desmontagem.",
  alternates: { canonical: "/" },
};

const PROCESS = [
  ["Conte o que você precisa", "Data, local e o tipo de evento. Quanto mais detalhes, mais certeira a indicação."],
  ["Escolha a estrutura", "Veja as estruturas disponíveis para a sua data, com fotos reais."],
  ["Definimos os detalhes", "Nossa equipe confirma o pedido, as medidas do local e a logística."],
  ["Montagem no local", "A estrutura é levada e montada no endereço do evento."],
  ["Seu evento pronto", "Você recebe tudo montado. Depois do evento, cuidamos da desmontagem."],
] as const;

const REASONS = [
  ["Estruturas para diferentes necessidades", "Modelos e tamanhos variados para diferentes formatos de evento."],
  ["Atendimento especializado", "Orientação na escolha da estrutura certa para o espaço e para o público."],
  ["Montagem e desmontagem", "Nossa equipe monta a estrutura no local e retira depois do evento."],
  ["Organização logística", "Saída, montagem e retorno planejados em torno da data do seu evento."],
  ["Atendimento em Sinop e região", "Base em Sinop - MT, atendendo eventos na cidade e na região."],
] as const;

const H2 = "text-[30px] font-semibold uppercase leading-[1.02] tracking-[-0.02em] text-night sm:text-[44px] lg:text-[56px]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.3em]";

export default async function HomePage() {
  const [settings, products] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);

  // Fotos reais cadastradas no painel. Capa: 1ª foto do 1º produto em "Destaque" (ou do 1º produto com foto).
  const withPhotos = products.filter((p) => productPhotos(p).length);
  const cover = withPhotos.find((p) => p.featured) ?? withPhotos[0] ?? null;
  const coverPhoto = cover ? productPhotos(cover)[0] : null;
  const pool = withPhotos.flatMap((p) => productPhotos(p).map((id) => ({ id, name: p.name }))).filter((x) => x.id !== coverPhoto);
  const reasonsPhoto = pool[0] ?? null;
  const ctaPhoto = pool[1] ?? pool[0] ?? (coverPhoto && cover ? { id: coverPhoto, name: cover.name } : null);

  const categories = [...new Set(products.map((p) => p.category))].map((name) => {
    const inCat = products.filter((p) => p.category === name);
    const withPhoto = inCat.find((p) => productPhotos(p).length);
    return {
      name,
      count: inCat.length,
      photoId: withPhoto ? productPhotos(withPhoto)[0] : null,
      description: inCat.find((p) => p.description)?.description ?? null,
    };
  });

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

      {/* ───────────── Hero: a fotografia vende a empresa ───────────── */}
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#05101f] text-white">
        <SiteHeader overlay />
        {coverPhoto ? (
          <div className="absolute inset-0 -z-10" aria-hidden={false}>
            <div className="h-full w-full animate-slow-zoom">
              <Photo id={coverPhoto} alt={cover!.name} priority sizes="100vw" className="object-[50%_60%]" />
            </div>
            {/* overlay escuro elegante: mais forte à esquerda (texto) e embaixo; vinheta leve */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,10,22,0.82)_0%,rgba(3,10,22,0.55)_45%,rgba(3,10,22,0.15)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,22,0.55)_0%,transparent_22%,transparent_60%,rgba(3,10,22,0.85)_100%)]" />
            <div className="absolute inset-0 shadow-[inset_0_0_220px_rgba(0,0,0,0.45)]" />
          </div>
        ) : (
          // Sem foto oficial cadastrada: composição pronta para receber a fotografia (nunca uma imagem genérica).
          <div className="absolute inset-0 -z-10" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_60%,#12305a_0%,#05101f_70%)]" />
            <TentDrawing strokeWidth={0.6} className="absolute bottom-[-6%] right-[-10%] w-[120%] max-w-[1200px] text-white/[0.12] lg:w-[72%]" />
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col justify-end px-5 pb-12 pt-32 sm:px-10 sm:pb-16 lg:justify-center lg:pb-24">
          <p className={`${EYEBROW} animate-rise text-white/65`}>Universo Tendas · {settings.city}</p>
          <h1 className="mt-6 max-w-[15ch] animate-rise text-[42px] font-semibold uppercase leading-[0.98] tracking-[-0.03em] [animation-delay:80ms] [text-wrap:balance] sm:text-[64px] lg:text-[96px]">
            Estrutura para eventos que impressionam.
          </h1>
          <p className="mt-6 max-w-[34rem] animate-rise text-[17px] leading-relaxed text-white/80 [animation-delay:140ms] sm:text-[19px]">
            Locação de tendas e estruturas para eventos, empresas e grandes projetos em Sinop e região.
          </p>
          <div className="mt-10 flex animate-rise flex-col gap-3 [animation-delay:200ms] sm:flex-row">
            <Link href={QUOTE_HREF} className="inline-flex h-14 items-center justify-center bg-white px-9 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-night transition-colors hover:bg-linen">
              Solicitar orçamento
            </Link>
            <Link href="/tendas" className="group inline-flex h-14 items-center justify-center gap-3 border border-white/45 px-9 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-white hover:bg-white/10">
              Conhecer nossas tendas <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
          <ul className="mt-8 flex animate-rise flex-col gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/60 [animation-delay:260ms] sm:flex-row sm:flex-wrap sm:gap-x-5">
            {["Atendimento profissional", "Montagem e desmontagem", "Sinop e região"].map((t, i) => (
              <li key={t} className="flex items-center gap-3 whitespace-nowrap sm:gap-5">
                <span aria-hidden className="block h-px w-4 bg-white/40 sm:hidden" />
                {i ? <span aria-hidden className="hidden text-white/30 sm:inline">•</span> : null}
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto hidden w-full max-w-[1360px] items-end justify-between px-10 pb-8 text-[11px] uppercase tracking-[0.22em] text-white/50 lg:flex">
          <a href="#solucoes" className="inline-flex items-center gap-3 hover:text-white">
            <span className="block h-10 w-px bg-white/40" aria-hidden /> Role para conhecer
          </a>
          {cover ? (
            <Link href={productPath(cover)} className="hover:text-white">
              Na foto: {cover.name}
            </Link>
          ) : null}
        </div>
      </section>

      {/* ───────────── Soluções: categorias reais do catálogo ───────────── */}
      <section id="solucoes" className="scroll-mt-20 bg-white py-24 sm:py-32" aria-labelledby="solucoes-titulo">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-10">
          <div className="reveal grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className={`${EYEBROW} text-night/45`}>Soluções</p>
              <h2 id="solucoes-titulo" className={`mt-5 ${H2}`}>Estruturas para cada tipo de evento</h2>
            </div>
            <p className="max-w-md text-[17px] leading-relaxed text-night/60 lg:justify-self-end">
              Conheça as estruturas do nosso catálogo. Cada uma com fotos reais e disponibilidade consultada na hora para a data do seu evento.
            </p>
          </div>

          {categories.length ? (
            <ul className={`mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 ${categories.length >= 3 ? "lg:grid-cols-3" : ""}`}>
              {categories.map((c, i) => (
                <li key={c.name} className="reveal" style={{ transitionDelay: `${(i % 3) * 90}ms` }}>
                  <Link href={`/tendas?categoria=${encodeURIComponent(c.name)}`} className="group block">
                    <div className="relative aspect-[4/5] overflow-hidden bg-sand">
                      <Photo id={c.photoId} alt={c.name} className="transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                      <span className="absolute left-5 top-5 text-[11px] font-semibold tracking-[0.2em] text-white mix-blend-difference">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-6 text-[20px] font-semibold uppercase tracking-[0.02em] text-night">{c.name}</h3>
                    <p className="mt-2 line-clamp-2 min-h-[3em] text-[15px] leading-relaxed text-night/60">
                      {c.description ?? `${c.count} ${c.count === 1 ? "modelo disponível" : "modelos disponíveis"} no catálogo.`}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-3 border-b border-night pb-1 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-night">
                      Ver estrutura <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-16 border-t border-night/10 pt-8 text-[16px] text-night/60">
              O catálogo está sendo preparado. Fale com a nossa equipe para conhecer as estruturas disponíveis.
            </p>
          )}
        </div>
      </section>

      {/* ───────────── Processo ───────────── */}
      <section id="como-funciona" className="scroll-mt-20 border-t border-night/10 bg-linen py-24 sm:py-32" aria-labelledby="processo-titulo">
        <div className="mx-auto max-w-[1360px] px-5 sm:px-10">
          <div className="reveal max-w-3xl">
            <p className={`${EYEBROW} text-night/45`}>Como funciona</p>
            <h2 id="processo-titulo" className={`mt-5 ${H2}`}>Do planejamento à montagem</h2>
          </div>
          <ol className="mt-16 grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
            {PROCESS.map(([title, text], i) => (
              <li key={title} className="reveal border-t border-night/20 py-8 sm:pr-8 lg:py-10" style={{ transitionDelay: `${i * 70}ms` }}>
                <span className="block text-[13px] font-semibold tracking-[0.2em] text-ink">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-5 text-[18px] font-semibold uppercase leading-snug tracking-[0.01em] text-night">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-night/60">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── Por que a Universo Tendas ───────────── */}
      <section className="bg-[#05101f] text-white" aria-labelledby="porque-titulo">
        <div className="mx-auto grid max-w-[1360px] lg:grid-cols-2">
          <div className="relative min-h-[320px] overflow-hidden lg:min-h-[640px]">
            {reasonsPhoto ? (
              <Photo id={reasonsPhoto.id} alt={reasonsPhoto.name} sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,#12305a_0%,#05101f_75%)]" aria-hidden>
                <TentDrawing variant="articulada" strokeWidth={0.8} className="w-[70%] text-white/15" />
              </div>
            )}
          </div>
          <div className="px-5 py-20 sm:px-10 lg:px-16 lg:py-28">
            <p className={`${EYEBROW} reveal text-white/45`}>Por que nós</p>
            <h2 id="porque-titulo" className="reveal mt-5 text-[30px] font-semibold uppercase leading-[1.02] tracking-[-0.02em] sm:text-[44px]">
              Por que escolher a Universo Tendas?
            </h2>
            <ul className="mt-12 divide-y divide-white/12 border-y border-white/12">
              {REASONS.map(([title, text]) => (
                <li key={title} className="reveal grid gap-2 py-6 sm:grid-cols-[1fr_1.2fr] sm:gap-8">
                  <h3 className="text-[15px] font-semibold uppercase tracking-[0.08em]">{title}</h3>
                  <p className="text-[15px] leading-relaxed text-white/60">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────── Sobre nós ───────────── */}
      <section id="sobre" className="scroll-mt-20 bg-white py-24 sm:py-32" aria-labelledby="sobre-titulo">
        <div className="reveal mx-auto grid max-w-[1360px] gap-10 px-5 sm:px-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className={`${EYEBROW} text-night/45`}>Sobre nós</p>
            <h2 id="sobre-titulo" className={`mt-5 ${H2}`}>Universo Tendas</h2>
          </div>
          <div className="space-y-6 text-[18px] leading-relaxed text-night/70 lg:pt-12">
            <p>
              Somos uma empresa de locação de tendas e estruturas para eventos em {settings.city}. Atendemos eventos sociais, empresas e
              grandes projetos em Sinop e região, com montagem e desmontagem feitas pela nossa equipe.
            </p>
            <p>
              Do primeiro contato ao dia do evento, cuidamos da estrutura para que você possa cuidar do resto.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────── Chamada final sobre fotografia ───────────── */}
      <section className="relative isolate overflow-hidden bg-[#05101f] text-white" aria-labelledby="cta-titulo">
        {ctaPhoto ? (
          <div className="absolute inset-0 -z-10">
            <Photo id={ctaPhoto.id} alt={ctaPhoto.name} sizes="100vw" />
            <div className="absolute inset-0 bg-[rgba(3,10,22,0.72)]" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_100%,#12305a_0%,#05101f_70%)]" aria-hidden />
        )}
        <div className="reveal mx-auto flex max-w-[1360px] flex-col items-start px-5 py-28 sm:px-10 sm:py-40">
          <h2 id="cta-titulo" className="max-w-[18ch] text-[32px] font-semibold uppercase leading-[1.02] tracking-[-0.02em] [text-wrap:balance] sm:text-[52px] lg:text-[68px]">
            Vamos montar a estrutura do seu evento?
          </h2>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/75 sm:text-[19px]">
            Conte o que você precisa e nossa equipe entra em contato para entender o seu projeto.
          </p>
          <Link href={QUOTE_HREF} className="mt-10 inline-flex h-14 w-full items-center justify-center bg-white px-10 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-night transition-colors hover:bg-linen sm:w-auto">
            Solicitar orçamento
          </Link>
        </div>
      </section>

      {/* ───────────── Contato ───────────── */}
      <section id="contato" className="scroll-mt-20 bg-linen py-24 sm:py-28" aria-labelledby="contato-titulo">
        <div className="mx-auto grid max-w-[1360px] gap-14 px-5 sm:px-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="reveal">
            <p className={`${EYEBROW} text-night/45`}>Contato</p>
            <h2 id="contato-titulo" className={`mt-5 ${H2}`}>Fale com a gente</h2>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 items-center justify-center whitespace-nowrap bg-night px-8 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-night-soft">
                  Falar pelo WhatsApp
                </a>
              ) : null}
              <Link href={QUOTE_HREF} className="inline-flex h-14 items-center justify-center whitespace-nowrap border border-night/25 px-8 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-night hover:border-night">
                Solicitar orçamento
              </Link>
            </div>
          </div>
          <dl className="reveal grid gap-10 sm:grid-cols-2 lg:pt-14">
            <ContactItem label="Endereço">
              <span className="block">{settings.companyName}</span>
              {settings.address ? <span className="block">{settings.address}</span> : null}
              <span className="block">{settings.city}</span>
              <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="link-grow mt-3 inline-block text-[13px] uppercase tracking-[0.16em] text-night/60">
                Ver no mapa →
              </a>
            </ContactItem>
            <ContactItem label="Telefones">
              {settings.phones ? <span className="block">Telefone: {settings.phones.split("·")[0].trim()}</span> : null}
              {settings.whatsappNumber ? <span className="block">WhatsApp: {formatPhoneDisplay(settings.whatsappNumber)}</span> : null}
              {ig ? (
                <a href={ig} target="_blank" rel="noopener noreferrer" className="link-grow mt-1 inline-block">
                  Instagram: {settings.instagram}
                </a>
              ) : null}
            </ContactItem>
          </dl>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </>
  );
}

function ContactItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-night/20 pt-6">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.24em] text-night/45">{label}</dt>
      <dd className="mt-4 text-[17px] leading-relaxed text-night">{children}</dd>
    </div>
  );
}
