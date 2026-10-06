import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/site/PageIntro";
import { Photo } from "@/components/site/Photo";
import { SiteFooter } from "@/components/site/SiteChrome";
import { ui } from "@/components/site/ui";
import { checkEventDates } from "@/lib/booking";
import { KIND_LABEL } from "@/lib/domain";
import { fmtDate, money } from "@/lib/format";
import { startOfDay } from "@/lib/time";
import { prisma } from "@/server/db";
import { listPublicProducts, productPath, productPhotos, publicAvailability } from "@/server/public-booking";
import { getSiteSettings } from "@/server/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tendas para locação",
  description: "Catálogo de tendas e estruturas da Universo Tendas em Sinop - MT, com fotos reais e disponibilidade por data.",
  alternates: { canonical: "/tendas" },
};

type Search = { categoria?: string; tipo?: string; tamanho?: string; inicio?: string; fim?: string; livres?: string };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const [settings, all] = await Promise.all([getSiteSettings(), listPublicProducts(prisma)]);

  const categories = [...new Set(all.map((p) => p.category))];
  const sizes = [...new Set(all.map((p) => p.dimensions).filter((d): d is string => Boolean(d)))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const kinds = [...new Set(all.map((p) => p.kind))];

  let products = all;
  if (sp.categoria) products = products.filter((p) => p.category === sp.categoria);
  if (sp.tipo === "RENTAL" || sp.tipo === "BOTH") products = products.filter((p) => p.kind === sp.tipo);
  if (sp.tamanho) products = products.filter((p) => p.dimensions === sp.tamanho);

  // Disponibilidade por período: mesma regra do painel (availabilityForPeriod), já com a margem operacional.
  const hasDates = Boolean(sp.inicio && sp.fim);
  const dateError = hasDates ? checkEventDates(sp.inicio!, sp.fim!) : null;
  let free: Record<string, number> | null = null;
  if (hasDates && !dateError && products.length) {
    free = (await publicAvailability(prisma, products.map((p) => p.id), sp.inicio!, sp.fim!)).free;
    if (sp.livres === "1") products = products.filter((p) => (free![p.id] ?? 0) > 0);
  }
  const keep = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/tendas?${s}` : "/tendas";
  };
  const reserveHref = (slug: string) => `/reservar?tenda=${slug}${hasDates && !dateError ? `&inicio=${sp.inicio}&fim=${sp.fim}` : ""}`;

  // Capa da página: a 1ª foto real do catálogo (destaque primeiro); sem fotos, o fundo da marca.
  const coverProduct = all.find((p) => p.featured && productPhotos(p).length) ?? all.find((p) => productPhotos(p).length);
  const coverPhoto = coverProduct ? productPhotos(coverProduct)[0] : null;

  return (
    <>
      <PageIntro
        eyebrow="Catálogo"
        title={sp.categoria && categories.includes(sp.categoria) ? sp.categoria : "Nossas tendas"}
        text="Estruturas com fotos reais e disponibilidade consultada na hora para a data do seu evento."
        photoId={coverPhoto}
        photoAlt={coverProduct?.name}
      />

      {/* Filtros */}
      <div className="sticky top-0 z-20 border-b border-night/10 bg-linen/95 backdrop-blur">
        <nav aria-label="Categorias" className="no-scrollbar mx-auto flex max-w-[1360px] gap-8 overflow-x-auto px-5 sm:px-10">
          <FilterTab href={keep({ categoria: undefined })} active={!sp.categoria}>Todas</FilterTab>
          {categories.map((c) => (
            <FilterTab key={c} href={keep({ categoria: c })} active={sp.categoria === c}>{c}</FilterTab>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-[1360px] px-5 pb-28 sm:px-10">
        <form method="get" className="grid gap-4 border-b border-night/10 py-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
          {sp.categoria ? <input type="hidden" name="categoria" value={sp.categoria} /> : null}
          <label className="block">
            <span className={ui.label}>Início do evento</span>
            <input type="date" name="inicio" defaultValue={sp.inicio} className={ui.input} />
          </label>
          <label className="block">
            <span className={ui.label}>Término do evento</span>
            <input type="date" name="fim" defaultValue={sp.fim} className={ui.input} />
          </label>
          {sizes.length ? (
            <label className="block">
              <span className={ui.label}>Tamanho</span>
              <select name="tamanho" defaultValue={sp.tamanho ?? ""} className={ui.input}>
                <option value="">Todos</option>
                {sizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          ) : null}
          {kinds.length > 1 ? (
            <label className="block">
              <span className={ui.label}>Tipo</span>
              <select name="tipo" defaultValue={sp.tipo ?? ""} className={ui.input}>
                <option value="">Todos</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-1">
            <label className="inline-flex h-12 items-center gap-2.5 text-[13px] text-night/75">
              <input type="checkbox" name="livres" value="1" defaultChecked={sp.livres === "1"} className="h-4 w-4 accent-[#081b36]" />
              Só disponíveis
            </label>
            <button className={`${ui.btnPrimary} h-12 flex-1 lg:flex-none`}>Consultar</button>
          </div>
          {dateError ? <p className="text-[14px] text-accent sm:col-span-2 lg:col-span-5">{dateError}</p> : null}
          {free ? (
            <p className="text-[14px] text-night/60 sm:col-span-2 lg:col-span-5">
              Disponibilidade para {fmtDate(startOfDay(sp.inicio!))} a {fmtDate(startOfDay(sp.fim!))}, já considerando a preparação antes e depois do evento.
            </p>
          ) : null}
        </form>

        <p className={`${ui.label} mt-10`}>
          {products.length} {products.length === 1 ? "estrutura" : "estruturas"}
        </p>

        {/* Lista: fotografia em primeiro plano, informação enxuta */}
        {products.length ? (
          <ul className="mt-8 grid gap-x-8 gap-y-20 md:grid-cols-2">
            {products.map((p, i) => {
              const photo = productPhotos(p)[0];
              const n = free?.[p.id];
              return (
                <li key={p.id} className="reveal group" style={{ transitionDelay: `${(i % 2) * 90}ms` }}>
                  <Link href={productPath(p)} className="-mx-5 block overflow-hidden sm:mx-0" aria-label={p.name}>
                    <div className="relative aspect-[4/3] bg-sand">
                      <Photo id={photo} alt={p.name} className="transition-transform duration-[1.4s] ease-out group-hover:scale-[1.04]" sizes="(min-width: 768px) 50vw, 100vw" />
                      {n != null ? (
                        <span className={`absolute left-0 top-5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${n > 0 ? "bg-white text-night" : "bg-night text-white"}`}>
                          {n > 0 ? `${n} ${n === 1 ? "disponível" : "disponíveis"} na data` : "Indisponível na data"}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="min-w-0">
                      <p className={`${ui.label} text-night/45`}>
                        {p.category}
                        {p.dimensions ? <span className="text-night/35"> · {p.dimensions}</span> : null}
                      </p>
                      <h2 className="mt-2 text-[22px] font-semibold uppercase leading-tight tracking-[0.01em] text-night sm:text-[24px]">
                        <Link href={productPath(p)}>{p.name}</Link>
                      </h2>
                      {p.description ? <p className="mt-2 line-clamp-2 max-w-lg text-[15px] leading-relaxed text-night/60">{p.description}</p> : null}
                      <p className="mt-3 text-[15px] text-night">
                        {p.rentalPriceCents != null ? (
                          <>
                            <span className="font-semibold">{money(p.rentalPriceCents)}</span>
                            <span className="text-night/50"> / dia</span>
                          </>
                        ) : (
                          <span className="text-night/55">Valor a consultar</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 sm:flex-col sm:items-end sm:gap-4">
                      {n !== 0 ? (
                        <Link href={reserveHref(p.slug ?? p.id)} className={ui.btnSmall}>
                          Reservar
                        </Link>
                      ) : null}
                      <Link href={productPath(p)} className={ui.link}>
                        Ver detalhes <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-t border-night/10 py-24 text-center">
            <p className="text-[22px] font-semibold uppercase tracking-[0.01em]">{all.length ? "Nenhuma estrutura com esses filtros." : "O catálogo está sendo preparado."}</p>
            {all.length ? (
              <Link href="/tendas" className={`${ui.link} mt-6`}>Limpar filtros</Link>
            ) : (
              <p className="mt-3 text-night/60">Fale com a gente pelo WhatsApp para consultar disponibilidade.</p>
            )}
          </div>
        )}
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}

function FilterTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`relative flex h-14 shrink-0 items-center whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors ${
        active ? "text-night after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-night" : "text-night/45 hover:text-night"
      }`}
    >
      {children}
    </Link>
  );
}
