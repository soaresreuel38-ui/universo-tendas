import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ProductImage } from "@/components/products/ProductImage";
import { StockBar, StockLegend } from "@/components/stock/StockBar";
import { Icon } from "@/components/ui/icons";
import { EmptyState, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { stockOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Estoque" };

type Search = { q?: string; categoria?: string; filtro?: string };

const FILTERS = [
  ["", "Todos"],
  ["reservados", "Com reservas"],
  ["alugados", "Em locação"],
  ["manutencao", "Em manutenção"],
  ["baixo", "Estoque baixo"],
] as const;

export default async function StockPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(sp.categoria ? { category: sp.categoria } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [all, categories] = await Promise.all([
    stockOverview(where),
    prisma.product.findMany({ where: { active: true }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  let rows = all;
  if (sp.filtro === "baixo") rows = rows.filter((r) => r.low);
  if (sp.filtro === "alugados") rows = rows.filter((r) => r.qtyRented > 0);
  if (sp.filtro === "reservados") rows = rows.filter((r) => r.reserved > 0);
  if (sp.filtro === "manutencao") rows = rows.filter((r) => r.qtyMaintenance > 0);
  const t = rows.reduce(
    (a, r) => ({ free: a.free + r.free, reserved: a.reserved + r.reserved, rented: a.rented + r.qtyRented, maintenance: a.maintenance + r.qtyMaintenance, total: a.total + r.total }),
    { free: 0, reserved: 0, rented: 0, maintenance: 0, total: 0 },
  );
  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/admin/estoque${p.size ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        hero
        eyebrow="Estoque"
        title="Estoque por produto"
        description="Como cada item está distribuído agora. Toque no produto para ver o histórico de movimentações."
        actions={
          <>
            <LinkButton href="/admin/estoque/entrada" icon="arrowIn">
              Entrada
            </LinkButton>
            <LinkButton href="/admin/estoque/saida" icon="arrowOut">
              Saída
            </LinkButton>
          </>
        }
      />

      <Section className="mb-6">
        <StockLegend parts={t} total={t.total} />
        <StockBar className="mt-5" parts={t} />
      </Section>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form role="search" className="relative lg:w-72">
          {sp.filtro ? <input type="hidden" name="filtro" value={sp.filtro} /> : null}
          {sp.categoria ? <input type="hidden" name="categoria" value={sp.categoria} /> : null}
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Produto ou código…"
            aria-label="Buscar no estoque"
            className="h-10 w-full rounded-lg border border-line-strong bg-white pl-9 pr-3 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-ink/10"
          />
        </form>
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-[13px] sm:mx-0 sm:px-0" aria-label="Filtros">
          {FILTERS.map(([k, l]) => (
            <Link
              key={k}
              href={link({ filtro: k || undefined })}
              className={`shrink-0 rounded-md px-2.5 py-1.5 ${(sp.filtro ?? "") === k ? "bg-ink-tint font-medium text-ink" : "text-muted hover:text-graphite"}`}
            >
              {l}
            </Link>
          ))}
        </nav>
        {categories.length > 1 ? (
          <form className="lg:ml-auto">
            {sp.filtro ? <input type="hidden" name="filtro" value={sp.filtro} /> : null}
            <select
              name="categoria"
              defaultValue={sp.categoria ?? ""}
              aria-label="Categoria"
              className="h-10 rounded-lg border border-line-strong bg-white px-3 text-sm"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
            <button className="ml-2 h-10 rounded-lg border border-line-strong bg-white px-3 text-sm">Aplicar</button>
          </form>
        ) : null}
      </div>

      <Section padded={false}>
        {rows.length === 0 ? (
          <EmptyState icon="layers">{q || sp.filtro ? "Nenhum produto com esses filtros." : "Nenhum produto ativo cadastrado."}</EmptyState>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,0.5fr))_minmax(0,1fr)] gap-4 border-b border-line px-5 py-3 md:grid">
              {["Produto", "Total", "Disponível", "Reservado", "Em locação", "Manutenção", "Distribuição"].map((h, i) => (
                <span key={h} className={`eyebrow ${i > 0 && i < 6 ? "text-right" : ""}`}>
                  {h}
                </span>
              ))}
            </div>
            <ul className="divide-y divide-line/70">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/produtos/${r.id}#historico`}
                    className="grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-paper md:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,0.5fr))_minmax(0,1fr)]"
                  >
                    <span className="flex min-w-0 items-center gap-3.5 max-md:contents">
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
                        <ProductImage photoId={r.photoId} name={r.name} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-graphite">{r.name}</span>
                        <span className="block truncate text-xs text-faint">
                          <span className="font-mono">{r.sku}</span> · {r.category}
                        </span>
                        {r.low ? <span className="mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-accent">Estoque baixo</span> : null}
                      </span>
                    </span>
                    <span className="col-span-2 grid grid-cols-5 gap-2 text-center md:contents md:text-right">
                      {[
                        ["Total", r.total, "text-graphite font-semibold"],
                        ["Disp.", r.free, r.free > 0 ? "text-st-free font-semibold" : "text-faint"],
                        ["Res.", r.reserved, r.reserved ? "text-[#244f8a]" : "text-faint"],
                        ["Loc.", r.qtyRented, r.qtyRented ? "text-[#8a5413]" : "text-faint"],
                        ["Man.", r.qtyMaintenance, r.qtyMaintenance ? "text-[#5f554c]" : "text-faint"],
                      ].map(([l, v, cls]) => (
                        <span key={l as string} className="tabular text-sm">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-faint md:hidden">{l}</span>
                          <span className={cls as string}>{v as number}</span>
                        </span>
                      ))}
                    </span>
                    <span className="col-span-2 md:col-span-1">
                      <StockBar thin parts={{ free: r.free, reserved: r.reserved, rented: r.qtyRented, maintenance: r.qtyMaintenance }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
      <p className="mt-3 text-xs text-faint">
        Disponível = no depósito e livre agora, já descontadas as reservas. Para outra data, use o{" "}
        <Link href="/admin/calendario" className="underline">
          calendário
        </Link>{" "}
        ou a disponibilidade por data na página do produto.
      </p>
    </div>
  );
}
