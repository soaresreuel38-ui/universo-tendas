import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ProductImage } from "@/components/products/ProductImage";
import { Icon } from "@/components/ui/icons";
import { EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui/primitives";
import { KIND_LABEL, can } from "@/lib/domain";
import { money } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { reservedByProduct } from "@/server/availability";

export const metadata: Metadata = { title: "Catálogo" };

type Search = { q?: string; categoria?: string; tipo?: string; disp?: string; status?: string; excluido?: string; filtro?: string };

function qs(sp: Search, patch: Partial<Search>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch, excluido: undefined, filtro: undefined })) if (v) p.set(k, v);
  const s = p.toString();
  return `/admin/produtos${s ? `?${s}` : ""}`;
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
        on ? "border-graphite bg-graphite text-white" : "border-line bg-white text-muted hover:border-line-strong hover:text-graphite"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  // Links antigos (?filtro=baixo) continuam funcionando.
  if (sp.filtro === "baixo" && !sp.disp) sp.disp = "baixo";
  const q = sp.q?.trim().slice(0, 80) ?? "";

  const where: Prisma.ProductWhereInput = {
    active: sp.status === "inativos" ? false : sp.status === "todos" ? undefined : true,
    ...(sp.categoria ? { category: sp.categoria } : {}),
    ...(sp.tipo === "locacao" ? { kind: { in: ["RENTAL", "BOTH"] } } : sp.tipo === "venda" ? { kind: { in: ["SALE", "BOTH"] } } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [products, categoryRows] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { model3d: { select: { id: true } }, _count: { select: { images: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { photoId: true } } },
    }),
    prisma.product.groupBy({ by: ["category"], where: { active: true }, _count: { _all: true }, orderBy: { category: "asc" } }),
  ]);
  const reserved = await reservedByProduct(prisma, products.map((p) => p.id));
  let rows = products.map((p) => {
    const free = Math.max(0, p.qtyAvailable - (reserved.get(p.id) ?? 0));
    return { ...p, free, low: p.minStock > 0 && free <= p.minStock, cover: p.photoId ?? p.images[0]?.photoId ?? null };
  });
  if (sp.disp === "disponivel") rows = rows.filter((r) => r.free > 0);
  if (sp.disp === "indisponivel") rows = rows.filter((r) => r.free === 0);
  if (sp.disp === "baixo") rows = rows.filter((r) => r.low);

  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
  const allCount = categoryRows.reduce((s, c) => s + c._count._all, 0);
  const canManage = can(user.role, "product.manage");
  const filterLink = (active: boolean) => `rounded-md px-2 py-1 transition-colors ${active ? "bg-ink-tint font-medium text-ink" : "text-muted hover:text-graphite"}`;

  return (
    <div>
      <PageHeader
        eyebrow="Estoque"
        title="Catálogo"
        description="Tendas, estruturas e equipamentos com fotos reais, disponibilidade e preços."
        actions={
          <>
            <LinkButton href="/admin/estoque" icon="layers">
              Ver estoque
            </LinkButton>
            {canManage ? (
              <LinkButton href="/admin/produtos/novo" variant="primary" icon="plus">
                Novo produto
              </LinkButton>
            ) : null}
          </>
        }
      />
      {sp.excluido ? (
        <div className="mb-5">
          <Notice tone="ok">Produto excluído.</Notice>
        </div>
      ) : null}

      {/* Categorias reais do cadastro (nada inventado) */}
      <nav aria-label="Categorias" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Chip href={qs(sp, { categoria: undefined })} on={!sp.categoria}>
          Todas <span className="tabular text-[12px] opacity-60">{allCount}</span>
        </Chip>
        {categoryRows.map((c) => (
          <Chip key={c.category} href={qs(sp, { categoria: c.category })} on={sp.categoria === c.category}>
            {c.category} <span className="tabular text-[12px] opacity-60">{c._count._all}</span>
          </Chip>
        ))}
      </nav>

      <div className="mb-8 flex flex-col gap-3 border-y border-line py-3 lg:flex-row lg:items-center">
        <form role="search" className="relative lg:w-80">
          {sp.categoria ? <input type="hidden" name="categoria" value={sp.categoria} /> : null}
          {sp.tipo ? <input type="hidden" name="tipo" value={sp.tipo} /> : null}
          {sp.disp ? <input type="hidden" name="disp" value={sp.disp} /> : null}
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Buscar por nome ou código…"
            aria-label="Buscar no catálogo"
            className="h-10 w-full rounded-lg border border-line-strong bg-white pl-9 pr-3 text-sm outline-none transition focus:border-ink focus:ring-4 focus:ring-ink/10"
          />
        </form>
        <div className="flex flex-col gap-2 text-[13px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 lg:ml-auto">
          <span className="-mx-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap px-4 sm:mx-0 sm:px-0">
            <span className="eyebrow mr-1">Disponibilidade</span>
            {[
              ["", "Todas"],
              ["disponivel", "Disponível agora"],
              ["indisponivel", "Indisponível"],
              ["baixo", "Estoque baixo"],
            ].map(([k, l]) => (
              <Link key={k} href={qs(sp, { disp: k || undefined })} className={filterLink((sp.disp ?? "") === k)}>
                {l}
              </Link>
            ))}
          </span>
          <span className="-mx-4 flex items-center gap-1 overflow-x-auto whitespace-nowrap px-4 sm:mx-0 sm:px-0">
            <span className="eyebrow mr-1">Tipo</span>
            {[
              ["", "Todos"],
              ["locacao", "Locação"],
              ["venda", "Venda"],
            ].map(([k, l]) => (
              <Link key={k} href={qs(sp, { tipo: k || undefined })} className={filterLink((sp.tipo ?? "") === k)}>
                {l}
              </Link>
            ))}
          </span>
          {canManage ? (
            <Link href={qs(sp, { status: sp.status === "todos" ? undefined : "todos" })} className="text-faint underline-offset-4 hover:text-graphite hover:underline max-sm:hidden">
              {sp.status === "todos" ? "Ocultar desativados" : "Mostrar desativados"}
            </Link>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="grid"
          action={
            canManage && !q && !sp.categoria ? (
              <LinkButton href="/admin/produtos/novo" variant="primary" icon="plus">
                Cadastrar produto
              </LinkButton>
            ) : null
          }
        >
          {q || sp.categoria || sp.disp || sp.tipo ? "Nenhum produto com esses filtros." : "O catálogo ainda está vazio. Cadastre as tendas com as fotos reais."}
        </EmptyState>
      ) : (
        <div className="space-y-14">
          {[...groups.entries()].map(([category, items]) => (
            <section key={category} aria-label={category}>
              <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-line pb-3">
                <h2 className="text-xl font-semibold tracking-[-0.015em] text-graphite">{category}</h2>
                <span className="eyebrow">{items.length === 1 ? "1 item" : `${items.length} itens`}</span>
              </div>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((p, i) => {
                  // Destaque editorial: o primeiro item de categorias com 3 ou mais produtos ocupa duas colunas.
                  const featured = i === 0 && items.length >= 3;
                  const photos = p._count.images + (p.photoId && !p.images.some((x) => x.photoId === p.photoId) ? 1 : 0);
                  return (
                    <li key={p.id} className={featured ? "sm:col-span-2" : ""}>
                      <Link href={`/admin/produtos/${p.id}`} className="group block" data-testid="catalog-item">
                        <div className={`relative overflow-hidden rounded-2xl border border-line bg-canvas ${featured ? "aspect-[4/3] sm:aspect-[16/9]" : "aspect-[4/3]"}`}>
                          <div className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]">
                            <ProductImage photoId={p.cover} name={p.name} size={featured ? "full" : "thumb"} />
                          </div>
                          <div className="absolute left-3 top-3 flex gap-1.5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11.5px] font-medium text-graphite shadow-sm backdrop-blur">
                              <span className={`h-1.5 w-1.5 rounded-full ${p.free > 0 ? (p.low ? "bg-amber-500" : "bg-st-free") : "bg-st-late"}`} aria-hidden />
                              {p.free > 0 ? `${p.free} disponíve${p.free === 1 ? "l" : "is"}` : "Indisponível"}
                            </span>
                            {p.model3d ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-graphite/85 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur">
                                <Icon name="cube" className="h-3.5 w-3.5" /> 3D
                              </span>
                            ) : null}
                          </div>
                          {photos > 1 ? (
                            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                              <Icon name="image" className="h-3.5 w-3.5" /> {photos}
                            </span>
                          ) : null}
                          {!p.active ? <span className="absolute inset-0 flex items-center justify-center bg-white/65 text-sm font-medium text-muted">Desativado</span> : null}
                        </div>
                        <div className="mt-3.5 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className={`truncate font-semibold tracking-[-0.01em] text-graphite transition-colors group-hover:text-ink ${featured ? "text-lg" : "text-[15px]"}`}>{p.name}</h3>
                            <p className="mt-0.5 truncate text-[12.5px] text-faint">
                              <span className="font-mono">{p.sku}</span>
                              {p.dimensions ? ` · ${p.dimensions}` : ""} · {KIND_LABEL[p.kind]}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {p.kind !== "SALE" ? (
                              p.rentalPriceCents == null && p.monthlyPriceCents == null ? (
                                <p className="text-sm text-faint">Preço a definir</p>
                              ) : (
                                <>
                                  {p.rentalPriceCents != null ? (
                                    <p className="tabular text-[15px] font-semibold text-graphite">
                                      {money(p.rentalPriceCents)}
                                      <span className="text-xs font-normal text-faint">/dia</span>
                                    </p>
                                  ) : null}
                                  {p.monthlyPriceCents != null ? (
                                    <p className={`tabular ${p.rentalPriceCents != null ? "text-[12.5px] text-muted" : "text-[15px] font-semibold text-graphite"}`}>
                                      {money(p.monthlyPriceCents)}
                                      <span className="text-xs font-normal text-faint">/mês</span>
                                    </p>
                                  ) : null}
                                </>
                              )
                            ) : null}
                            {p.kind !== "RENTAL" && p.salePriceCents != null ? (
                              p.kind === "SALE" ? (
                                <p className="tabular text-[15px] font-semibold text-graphite">{money(p.salePriceCents)}</p>
                              ) : (
                                <p className="tabular text-[12.5px] text-muted">Venda {money(p.salePriceCents)}</p>
                              )
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
