import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ProductThumb } from "@/components/products/ProductThumb";
import { Badge, DataTable, LinkButton, Notice, PageHeader, Section } from "@/components/ui/primitives";
import { KIND_LABEL, can } from "@/lib/domain";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { stockOverview } from "@/server/queries";

export const metadata: Metadata = { title: "Estoque" };

type Search = { q?: string; categoria?: string; tipo?: string; filtro?: string; status?: string; excluido?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";

  const where: Prisma.ProductWhereInput = {
    active: sp.status === "inativos" ? false : sp.status === "todos" ? undefined : true,
    ...(sp.categoria ? { category: sp.categoria } : {}),
    ...(sp.tipo === "RENTAL" || sp.tipo === "SALE" || sp.tipo === "BOTH" ? { kind: sp.tipo } : {}),
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  let rows = await stockOverview(where);
  if (sp.filtro === "baixo") rows = rows.filter((r) => r.low);
  if (sp.filtro === "alugados") rows = rows.filter((r) => r.qtyRented > 0);
  if (sp.filtro === "reservados") rows = rows.filter((r) => r.reserved > 0);
  if (sp.filtro === "manutencao") rows = rows.filter((r) => r.qtyMaintenance > 0);

  const categories = (await prisma.product.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } })).map((c) => c.category);

  const total = rows.reduce(
    (acc, r) => ({ free: acc.free + r.free, reserved: acc.reserved + r.reserved, rented: acc.rented + r.qtyRented, maintenance: acc.maintenance + r.qtyMaintenance, total: acc.total + r.total }),
    { free: 0, reserved: 0, rented: 0, maintenance: 0, total: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="O que temos: disponível, reservado, alugado e em manutenção de cada produto."
        actions={
          <>
            <LinkButton href="/admin/estoque/entrada" icon="arrowIn">Entrada</LinkButton>
            <LinkButton href="/admin/estoque/saida" icon="arrowOut">Saída</LinkButton>
            {can(user.role, "product.manage") ? (
              <LinkButton href="/admin/produtos/novo" variant="primary" icon="plus">Novo produto</LinkButton>
            ) : null}
          </>
        }
      />
      {sp.excluido ? <div className="mb-4"><Notice tone="ok">Produto excluído.</Notice></div> : null}

      <form className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-[1fr_repeat(4,auto)_auto]" role="search">
        <input
          name="q"
          defaultValue={q}
          type="search"
          placeholder="Nome, código ou categoria"
          className="col-span-2 h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm md:col-span-1"
        />
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm">
          <option value="">Locação e venda</option>
          <option value="RENTAL">Só locação</option>
          <option value="SALE">Só venda</option>
          <option value="BOTH">Ambos</option>
        </select>
        <select name="filtro" defaultValue={sp.filtro ?? ""} className="h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm">
          <option value="">Qualquer situação</option>
          <option value="baixo">Estoque baixo</option>
          <option value="reservados">Com reservas</option>
          <option value="alugados">Com itens alugados</option>
          <option value="manutencao">Em manutenção</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm">
          <option value="">Ativos</option>
          <option value="inativos">Desativados</option>
          <option value="todos">Todos</option>
        </select>
        <button className="col-span-2 h-10 rounded-md bg-ink px-4 text-sm font-medium text-white md:col-span-1">Filtrar</button>
      </form>

      <Section padded={false}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/produtos/${r.id}`}
          empty={
            q || sp.categoria || sp.filtro ? "Nenhum produto encontrado com esses filtros." : "Nenhum produto cadastrado ainda. Cadastre o primeiro em “Novo produto”."
          }
          columns={[
            {
              header: "Produto",
              mobile: "title",
              cell: (r) => (
                <span className="flex items-center gap-3">
                  <ProductThumb photoId={r.photoId} name={r.name} />
                  <span className="min-w-0">
                    <span className="block truncate">{r.name}</span>
                    <span className="block font-mono text-xs font-normal text-zinc-500">
                      {r.sku} · {r.category}
                    </span>
                  </span>
                </span>
              ),
            },
            { header: "Tipo", mobile: "hide", cell: (r) => <Badge>{KIND_LABEL[r.kind]}</Badge> },
            {
              header: "Disponível",
              align: "right",
              cell: (r) => (
                <span className={`tabular font-semibold ${r.low ? "text-red-700" : r.free > 0 ? "text-emerald-700" : "text-zinc-400"}`}>
                  {r.free} <span className="text-xs font-normal text-zinc-400">{r.unit}</span>
                </span>
              ),
            },
            { header: "Reservado", align: "right", cell: (r) => <span className="tabular">{r.reserved || "—"}</span> },
            { header: "Alugado", align: "right", cell: (r) => <span className="tabular">{r.qtyRented || "—"}</span> },
            { header: "Manutenção", align: "right", cell: (r) => <span className="tabular">{r.qtyMaintenance || "—"}</span> },
            { header: "Pendente", align: "right", mobile: "hide", cell: (r) => <span className="tabular">{r.qtyPending || "—"}</span> },
            { header: "Total", align: "right", cell: (r) => <span className="tabular font-medium">{r.total}</span> },
            {
              header: "",
              mobile: "hide",
              cell: (r) => (!r.active ? <Badge tone="muted">Desativado</Badge> : r.low ? <Badge tone="danger">Baixo</Badge> : null),
            },
          ]}
        />
        {rows.length > 0 ? (
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">
            <span>{rows.length} produto(s)</span>
            <span>Disponível: <b className="tabular text-zinc-900">{total.free}</b></span>
            <span>Reservado: <b className="tabular text-zinc-900">{total.reserved}</b></span>
            <span>Alugado: <b className="tabular text-zinc-900">{total.rented}</b></span>
            <span>Manutenção: <b className="tabular text-zinc-900">{total.maintenance}</b></span>
            <span>Total: <b className="tabular text-zinc-900">{total.total}</b></span>
          </div>
        ) : null}
      </Section>
      <p className="mt-3 text-xs text-zinc-500">
        Disponível = no depósito e livre agora (já descontadas as reservas). Para ver a disponibilidade em uma data específica, abra o produto ou use o{" "}
        <Link href="/admin/calendario" className="underline">calendário</Link>.
      </p>
    </div>
  );
}
