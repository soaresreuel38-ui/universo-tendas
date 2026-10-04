import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/site/Photo";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-14 sm:px-8 md:pt-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-night/45">Catálogo</p>
        <h1 className="mt-4 font-display text-[44px] font-light leading-[1] tracking-[-0.02em] md:text-[72px]">Tendas</h1>

        {/* Filtros */}
        <div className="mt-10 space-y-5 border-y border-night/10 py-6">
          <nav aria-label="Categorias" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <FilterChip href={keep({ categoria: undefined })} active={!sp.categoria}>Todas</FilterChip>
            {categories.map((c) => (
              <FilterChip key={c} href={keep({ categoria: c })} active={sp.categoria === c}>{c}</FilterChip>
            ))}
          </nav>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
            {sp.categoria ? <input type="hidden" name="categoria" value={sp.categoria} /> : null}
            <label className="block">
              <span className="text-xs font-medium text-night/60">Início do evento</span>
              <input type="date" name="inicio" defaultValue={sp.inicio} className="mt-1 h-12 w-full rounded-lg border border-night/15 bg-white px-3 text-[16px]" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-night/60">Término do evento</span>
              <input type="date" name="fim" defaultValue={sp.fim} className="mt-1 h-12 w-full rounded-lg border border-night/15 bg-white px-3 text-[16px]" />
            </label>
            {sizes.length ? (
              <label className="block">
                <span className="text-xs font-medium text-night/60">Tamanho</span>
                <select name="tamanho" defaultValue={sp.tamanho ?? ""} className="mt-1 h-12 w-full rounded-lg border border-night/15 bg-white px-3 text-[16px]">
                  <option value="">Todos</option>
                  {sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {kinds.length > 1 ? (
              <label className="block">
                <span className="text-xs font-medium text-night/60">Tipo</span>
                <select name="tipo" defaultValue={sp.tipo ?? ""} className="mt-1 h-12 w-full rounded-lg border border-night/15 bg-white px-3 text-[16px]">
                  <option value="">Todos</option>
                  {kinds.map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k]}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1">
              <label className="inline-flex h-12 items-center gap-2 text-sm text-night/75">
                <input type="checkbox" name="livres" value="1" defaultChecked={sp.livres === "1"} className="h-4 w-4 accent-[#081b36]" />
                Só disponíveis
              </label>
              <button className="h-12 flex-1 rounded-full bg-night px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-night-soft lg:flex-none">
                Filtrar
              </button>
            </div>
          </form>
          {dateError ? <p className="text-sm text-accent">{dateError}</p> : null}
          {free ? (
            <p className="text-sm text-night/60">
              Disponibilidade para {fmtDate(startOfDay(sp.inicio!))} a {fmtDate(startOfDay(sp.fim!))}, já considerando a preparação antes e depois do evento.
            </p>
          ) : null}
        </div>

        {/* Lista */}
        {products.length ? (
          <ul className="mt-12 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const photo = productPhotos(p)[0];
              const n = free?.[p.id];
              return (
                <li key={p.id} className="reveal group">
                  <Link href={productPath(p)} className="block overflow-hidden rounded-[4px]">
                    <div className="relative aspect-[4/3]">
                      <Photo id={photo} alt={p.name} className="transition-transform duration-[1.2s] group-hover:scale-[1.04]" sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" />
                      {n != null ? (
                        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[12px] font-medium backdrop-blur ${n > 0 ? "bg-white/90 text-night" : "bg-night/85 text-white"}`}>
                          {n > 0 ? `${n} ${n === 1 ? "disponível" : "disponíveis"} na data` : "Indisponível na data"}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="mt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-night/45">{p.category}{p.dimensions ? ` · ${p.dimensions}` : ""}</p>
                    <h2 className="mt-2 font-display text-[26px] font-light leading-tight">
                      <Link href={productPath(p)} className="link-grow">{p.name}</Link>
                    </h2>
                    {p.description ? <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-night/65">{p.description}</p> : null}
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <p className="text-[15px]">
                        {p.rentalPriceCents != null ? (
                          <>
                            <span className="font-medium">{money(p.rentalPriceCents)}</span>
                            <span className="text-night/55"> / dia</span>
                          </>
                        ) : (
                          <span className="text-night/55">Valor a consultar</span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Link href={productPath(p)} className="inline-flex h-11 items-center rounded-full border border-night/20 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] hover:border-night">
                          Ver detalhes
                        </Link>
                        {n !== 0 ? (
                          <Link href={reserveHref(p.slug ?? p.id)} className="inline-flex h-11 items-center rounded-full bg-night px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-night-soft">
                            Reservar
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-24 text-center">
            <p className="font-display text-2xl font-light">{all.length ? "Nenhuma tenda com esses filtros." : "O catálogo está sendo preparado."}</p>
            {all.length ? (
              <Link href="/tendas" className="link-grow mt-4 inline-block text-night/70">Limpar filtros</Link>
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

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[14px] transition-colors ${
        active ? "border-night bg-night text-white" : "border-night/15 bg-white text-night/75 hover:border-night/40"
      }`}
    >
      {children}
    </Link>
  );
}
