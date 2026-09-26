import type { Metadata } from "next";
import { Badge, DataTable, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Vendas" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim().slice(0, 80) ?? "";
  const num = Number(q.replace(/\D/g, ""));
  const sales = await prisma.sale.findMany({
    where: q
      ? {
          OR: [
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customerName: { contains: q, mode: "insensitive" } },
            { items: { some: { product: { name: { contains: q, mode: "insensitive" } } } } },
            ...(num ? [{ number: num }] : []),
          ],
        }
      : {},
    include: { customer: { select: { name: true } }, user: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
    orderBy: { soldAt: "desc" },
    take: 300,
  });
  return (
    <div>
      <PageHeader
        title="Vendas"
        description="O que foi vendido. Produtos vendidos saem do estoque definitivamente."
        actions={<LinkButton href="/admin/vendas/nova" variant="primary" icon="plus">Nova venda</LinkButton>}
      />
      <form className="mb-3 flex gap-2" role="search">
        <input name="q" defaultValue={q} type="search" placeholder="Nº, cliente ou produto" className="h-10 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm" />
        <button className="h-10 rounded-lg bg-graphite px-4 text-sm font-medium text-white hover:bg-black">Buscar</button>
      </form>
      <Section padded={false}>
        <DataTable
          rows={sales}
          rowKey={(s) => s.id}
          rowHref={(s) => `/admin/vendas/${s.id}`}
          empty="Nenhuma venda registrada."
          columns={[
            { header: "Venda", mobile: "title", cell: (s) => <>#{seq(s.number)} — {s.customer?.name ?? s.customerName ?? "Venda avulsa"}</> },
            { header: "Data", cell: (s) => fmtDateTime(s.soldAt) },
            { header: "Produtos", cell: (s) => <span className="text-muted">{s.items.map((i) => `${i.quantity} ${i.product.name}`).join(", ")}</span> },
            { header: "Responsável", mobile: "hide", cell: (s) => s.user.name },
            { header: "Total", align: "right", cell: (s) => <span className={`tabular ${s.status === "CANCELADA" ? "text-faint line-through" : ""}`}>{money(s.totalCents)}</span> },
            { header: "", cell: (s) => (s.status === "CANCELADA" ? <Badge tone="muted">Cancelada</Badge> : <Badge tone="ok">Concluída</Badge>) },
          ]}
        />
      </Section>
    </div>
  );
}
