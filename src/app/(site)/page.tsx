import type { Metadata } from "next";
import Link from "next/link";
import { TentDrawing } from "@/components/brand/TentDrawing";
import { Photo } from "@/components/site/Photo";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { formatPhone } from "@/lib/br-documents";
import { money, whatsappLink } from "@/lib/format";
import { prisma } from "@/server/db";
import { listPublicProducts, productPath, productPhotos } from "@/server/public-booking";
import { getSiteSettings, instagramUrl } from "@/server/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Universo Tendas | Locação de Tendas em Sinop - MT" },
  alternates: { canonical: "/" },
};

const STEPS = [
  ["Escolha a tenda", "Veja as fotos reais, as informações e a disponibilidade de cada estrutura."],
  ["Informe a data e o local", "O sistema confere na hora quantas unidades estão livres para o seu período."],
  ["Revise e envie", "Sem cadastro: só os dados necessários. A reserva é registrada na hora."],
  ["Confirmamos com você", "A equipe analisa o pedido e segue com contrato e combinações pelo WhatsApp."],
] as const;

export default async function HomePage() {
  const [settings, products] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);
  const withPhoto = products.filter((p) => p.photoId || p.images.length);
  const cover = products.find((p) => p.featured && productPhotos(p).length) ?? null;
  const coverPhoto = cover ? productPhotos(cover)[0] : null;
  const featured = (products.some((p) => p.featured) ? products.filter((p) => p.featured) : products).slice(0, 3);
  const categories = [...new Map(products.map((p) => [p.category, p])).values()].map((p) => ({
    name: p.category,
    count: products.filter((x) => x.category === p.category).length,
    photoId: productPhotos(products.find((x) => x.category === p.category && productPhotos(x).length) ?? p)[0] ?? null,
  }));
  const gallery = withPhoto.flatMap((p) => productPhotos(p).map((id) => ({ id, name: p.name, path: productPath(p) }))).slice(0, 8);
  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas e gostaria de falar sobre uma locação.");
  const ig = instagramUrl(settings.instagram);
  const mapQuery = encodeURIComponent(settings.address ? `${settings.address}, ${settings.city}` : `Universo Tendas, ${settings.city}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings.companyName,
    ...(settings.address ? { address: settings.address } : {}),
    areaServed: settings.city,
    ...(settings.whatsappNumber ? { telephone: `+${settings.whatsappNumber}` } : {}),
    ...(ig ? { sameAs: [ig] } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* ───────────── Capa ───────────── */}
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-night text-white">
        <SiteHeader overlay />
        {coverPhoto ? (
          <div className="absolute inset-0 -z-10">
            <div className="h-full w-full animate-slow-zoom">
              <Photo id={coverPhoto} alt={cover!.name} priority sizes="100vw" />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,27,54,0.55)_0%,rgba(8,27,54,0.15)_38%,rgba(8,27,54,0.85)_100%)]" />
          </div>
        ) : (
          <div className="absolute inset-0 -z-10 flex items-end justify-end overflow-hidden" aria-hidden>
            <TentDrawing strokeWidth={0.7} className="mb-[-4%] mr-[-8%] w-[115%] max-w-[1100px] text-white/[0.13] md:w-[70%]" />
          </div>
        )}
        <div className="mx-auto flex min-h-[100svh] max-w-[1280px] flex-col justify-end px-4 pb-14 pt-32 sm:px-8 md:pb-20">
          <p className="animate-rise text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70">Universo Tendas · {settings.city}</p>
          <h1 className="mt-5 max-w-4xl animate-rise font-display text-[44px] font-light leading-[1.02] tracking-[-0.02em] [animation-delay:80ms] sm:text-[64px] md:text-[88px]">
            Estruturas para eventos.
            <span className="block italic text-white/80">Faça chuva ou faça sol.</span>
          </h1>
          <div className="mt-10 flex animate-rise flex-col gap-3 [animation-delay:160ms] sm:flex-row">
            <Link href="/reservar" className="inline-flex h-14 items-center justify-center rounded-full bg-white px-8 text-[13px] font-semibold uppercase tracking-[0.16em] text-night transition hover:bg-linen">
              Escolher minha tenda
            </Link>
            <Link href="/tendas" className="inline-flex h-14 items-center justify-center rounded-full border border-white/40 px-8 text-[13px] font-semibold uppercase tracking-[0.16em] text-white transition hover:border-white hover:bg-white/10">
              Ver tendas
            </Link>
          </div>
          {cover ? (
            <Link href={productPath(cover)} className="mt-12 hidden self-end text-right text-xs text-white/60 hover:text-white md:block">
              Na foto: <span className="underline underline-offset-4">{cover.name}</span>
            </Link>
          ) : null}
        </div>
      </section>

      {/* ───────────── Tipos de tendas ───────────── */}
      {categories.length ? (
        <section className="mx-auto max-w-[1280px] px-4 py-24 sm:px-8 md:py-32" aria-labelledby="tipos">
          <div className="reveal grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-end">
            <h2 id="tipos" className="font-display text-[36px] font-light leading-[1.05] tracking-[-0.02em] md:text-[52px]">
              Tipos de estruturas
            </h2>
            <p className="max-w-lg text-[17px] leading-relaxed text-night/65 md:justify-self-end">
              Cada estrutura com suas fotos reais e a disponibilidade calculada na hora para a data do seu evento.
            </p>
          </div>
          <ul className="mt-14 divide-y divide-night/10 border-y border-night/10">
            {categories.map((c, i) => (
              <li key={c.name} className="reveal">
                <Link href={`/tendas?categoria=${encodeURIComponent(c.name)}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 py-6 md:grid-cols-[80px_1fr_160px_auto] md:gap-8">
                  <span className="font-display text-sm text-night/40 tabular">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-display text-[26px] font-light tracking-[-0.01em] transition-transform duration-500 group-hover:translate-x-2 md:text-[34px]">{c.name}</span>
                  <span className="hidden h-20 overflow-hidden rounded-md md:block">
                    <Photo id={c.photoId} alt={c.name} size="thumb" className="transition-transform duration-700 group-hover:scale-105" />
                  </span>
                  <span className="text-sm text-night/55">
                    {c.count} {c.count === 1 ? "modelo" : "modelos"} <span aria-hidden className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ───────────── Destaques ───────────── */}
      {featured.length ? (
        <section className="bg-white py-24 md:py-32" aria-labelledby="destaques">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
            <div className="reveal flex items-end justify-between gap-6">
              <h2 id="destaques" className="font-display text-[36px] font-light leading-[1.05] tracking-[-0.02em] md:text-[52px]">Em destaque</h2>
              <Link href="/tendas" className="link-grow hidden text-[14px] text-night/70 sm:inline">Ver todas as tendas →</Link>
            </div>
            <div className="mt-14 space-y-20 md:space-y-28">
              {featured.map((p, i) => (
                <article key={p.id} className={`reveal grid items-center gap-8 md:grid-cols-12 md:gap-12`}>
                  <Link href={productPath(p)} className={`group block overflow-hidden rounded-[4px] md:col-span-7 ${i % 2 ? "md:order-2 md:col-start-6" : ""}`}>
                    <div className="aspect-[4/3]">
                      <Photo id={productPhotos(p)[0]} alt={p.name} className="transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]" sizes="(min-width: 768px) 58vw, 100vw" />
                    </div>
                  </Link>
                  <div className={`md:col-span-5 ${i % 2 ? "md:order-1 md:col-start-1 md:row-start-1" : ""}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-night/45">{p.category}</p>
                    <h3 className="mt-3 font-display text-[32px] font-light leading-[1.1] tracking-[-0.01em] md:text-[42px]">{p.name}</h3>
                    {p.dimensions ? <p className="mt-3 text-[15px] text-night/60">{p.dimensions}</p> : null}
                    {p.description ? <p className="mt-5 line-clamp-4 max-w-md text-[16px] leading-relaxed text-night/70">{p.description}</p> : null}
                    <p className="mt-6 text-[15px]">
                      {p.rentalPriceCents != null ? (
                        <>
                          <span className="font-display text-2xl">{money(p.rentalPriceCents)}</span>
                          <span className="text-night/55"> / dia</span>
                        </>
                      ) : (
                        <span className="text-night/60">Valor a consultar</span>
                      )}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link href={`/reservar?tenda=${p.slug ?? p.id}`} className="inline-flex h-12 items-center rounded-full bg-night px-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-night-soft">
                        Reservar
                      </Link>
                      <Link href={productPath(p)} className="inline-flex h-12 items-center rounded-full border border-night/20 px-6 text-[12px] font-semibold uppercase tracking-[0.16em] hover:border-night">
                        Ver detalhes
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-[1280px] px-4 py-24 text-center sm:px-8">
          <p className="font-display text-3xl font-light">O catálogo está sendo preparado.</p>
          <p className="mt-3 text-night/60">Enquanto isso, fale com a gente pelo WhatsApp para consultar disponibilidade.</p>
        </section>
      )}

      {/* ───────────── Como funciona ───────────── */}
      <section id="como-funciona" className="scroll-mt-20 bg-night py-24 text-white md:py-32" aria-labelledby="como">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
          <h2 id="como" className="reveal max-w-2xl font-display text-[36px] font-light leading-[1.05] tracking-[-0.02em] md:text-[52px]">
            Reservar é simples.
          </h2>
          <ol className="mt-16 grid gap-px overflow-hidden rounded-[4px] bg-white/10 md:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="reveal bg-night p-7 md:p-8" style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="font-display text-[56px] font-extralight leading-none text-white/25">{i + 1}</span>
                <h3 className="mt-6 text-[17px] font-medium">{title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-white/60">{text}</p>
              </li>
            ))}
          </ol>
          <div className="reveal mt-12">
            <Link href="/reservar" className="inline-flex h-14 items-center rounded-full bg-white px-8 text-[13px] font-semibold uppercase tracking-[0.16em] text-night hover:bg-linen">
              Começar minha reserva
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────── Benefícios (somente o que o sistema realmente faz) ───────────── */}
      <section className="mx-auto max-w-[1280px] px-4 py-24 sm:px-8 md:py-32" aria-label="Por que reservar pelo site">
        <div className="grid gap-12 md:grid-cols-3 md:gap-16">
          {[
            ["Disponibilidade real", "O mesmo estoque usado pela nossa equipe. Se aparece livre para a sua data, as unidades ficam separadas para você."],
            ["Sem cadastro", "Você informa só o necessário para a locação e acompanha tudo pelo número da reserva."],
            ["Atendimento direto", "Depois do pedido, a conversa continua com a nossa equipe pelo WhatsApp, com os dados da reserva prontos."],
          ].map(([t, d]) => (
            <div key={t} className="reveal border-t border-night pt-6">
              <h3 className="font-display text-[24px] font-light">{t}</h3>
              <p className="mt-3 text-[16px] leading-relaxed text-night/65">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Fotos reais ───────────── */}
      {gallery.length >= 3 ? (
        <section className="pb-24 md:pb-32" aria-labelledby="fotos">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
            <h2 id="fotos" className="reveal font-display text-[36px] font-light leading-[1.05] tracking-[-0.02em] md:text-[52px]">Nossas estruturas</h2>
          </div>
          <div className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:px-8 xl:px-[max(2rem,calc((100vw-1280px)/2+2rem))]">
            {gallery.map((g, i) => (
              <Link key={`${g.id}-${i}`} href={g.path} className="group relative w-[78vw] shrink-0 snap-start overflow-hidden rounded-[4px] sm:w-[420px]">
                <div className="aspect-[4/5]">
                  <Photo id={g.id} alt={g.name} className="transition-transform duration-[1.2s] group-hover:scale-[1.04]" sizes="(min-width: 640px) 420px, 78vw" />
                </div>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/80 to-transparent p-5 pt-16 text-[15px] text-white">{g.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ───────────── Localização e contato ───────────── */}
      <section id="contato" className="scroll-mt-20 border-t border-night/10 bg-white" aria-labelledby="contato-titulo">
        <div className="mx-auto grid max-w-[1280px] gap-14 px-4 py-24 sm:px-8 md:grid-cols-2 md:py-32">
          <div className="reveal">
            <h2 id="contato-titulo" className="font-display text-[36px] font-light leading-[1.05] tracking-[-0.02em] md:text-[52px]">Fale com a gente</h2>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-night/65">
              Dúvidas sobre medidas, montagem ou datas? Nossa equipe responde pelo WhatsApp.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 items-center justify-center rounded-full bg-[#1f8a5b] px-8 text-[13px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#1a764e]">
                  Falar pelo WhatsApp
                </a>
              ) : null}
              <Link href="/reservar" className="inline-flex h-14 items-center justify-center rounded-full border border-night/20 px-8 text-[13px] font-semibold uppercase tracking-[0.14em] hover:border-night">
                Fazer uma reserva
              </Link>
            </div>
          </div>
          <dl className="reveal grid gap-8 self-end sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-night/45">Localização</dt>
              <dd className="mt-3 text-[16px] leading-relaxed">
                {settings.address ? <span className="block">{settings.address}</span> : null}
                <span className="block">{settings.city}</span>
                <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="link-grow mt-2 inline-block text-night/60">
                  Abrir no mapa →
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-night/45">Contato</dt>
              <dd className="mt-3 space-y-1 text-[16px] leading-relaxed">
                {settings.whatsappNumber ? <span className="block">WhatsApp {formatPhone(settings.whatsappNumber)}</span> : null}
                {settings.phones ? <span className="block text-night/70">{settings.phones}</span> : null}
                {ig ? (
                  <a href={ig} target="_blank" rel="noopener noreferrer" className="link-grow block">
                    {settings.instagram}
                  </a>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ───────────── Chamada final ───────────── */}
      <section className="bg-linen">
        <div className="reveal mx-auto flex max-w-[1280px] flex-col items-start gap-8 px-4 py-24 sm:px-8 md:flex-row md:items-end md:justify-between md:py-28">
          <p className="max-w-2xl font-display text-[34px] font-light leading-[1.1] tracking-[-0.02em] md:text-[48px]">
            Tem uma data marcada? Veja agora o que está disponível.
          </p>
          <Link href="/reservar" className="inline-flex h-14 shrink-0 items-center rounded-full bg-night px-8 text-[13px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-night-soft">
            Escolher minha tenda
          </Link>
        </div>
      </section>

      <SiteFooter settings={settings} />
    </>
  );
}
