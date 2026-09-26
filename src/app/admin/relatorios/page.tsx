import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { Icon } from "@/components/ui/icons";
import { DataTable, PageHeader, Section, Stat } from "@/components/ui/primitives";
import { MOVEMENT_LABEL } from "@/lib/domain";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { reportData, resolvePeriod } from "@/server/reports";

export const metadata: Metadata = { title: "Relatórios" };

const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "personalizado", label: "Personalizado" },
];

function Block({ title, tipo, qs, children }: { title: string; tipo: string; qs: string; children: ReactNode }) {
  return (
    <Section
      title={title}
      padded={false}
      actions={
        <a href={`/api/relatorios/${tipo}?${qs}`} className="inline-flex items-center gap-1 text-sm text-zinc-600 underline hover:text-zinc-900">
          <Icon name="download" className="h-4 w-4" /> CSV/Excel
        </a>
      }
    >
      {children}
    </Section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ periodo?: string; de?: string; ate?: string }> }) {
  await requirePermission("report.view");
  const sp = await searchParams;
  const period = resolvePeriod(sp.periodo, sp.de, sp.ate);
  const d = await reportData(period);
  const qs = `periodo=${period.key}&de=${period.from}&ate=${period.to}`;
  return (
    <div className="space-y-4">
      <PageHeader title="Relatórios" description={`Período: ${period.label}`} />
      <form className="flex flex-wrap items-end gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 bg-white text-sm">
          {PERIODS.filter((p) => p.key !== "personalizado").map((p) => (
            <Link key={p.key} href={`/admin/relatorios?periodo=${p.key}`} className={`px-3 py-2 ${period.key === p.key ? "bg-ink text-white" : "hover:bg-zinc-50"}`}>
              {p.label}
            </Link>
          ))}
        </div>
        <input type="hidden" name="periodo" value="personalizado" />
        <label className="text-xs text-zinc-500">
          De
          <input type="date" name="de" defaultValue={period.from} className="mt-0.5 block h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm" />
        </label>
        <label className="text-xs text-zinc-500">
          Até
          <input type="date" name="ate" defaultValue={period.to} className="mt-0.5 block h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm" />
        </label>
        <button className={`h-10 rounded-md px-4 text-sm font-medium ${period.key === "personalizado" ? "bg-ink text-white" : "border border-zinc-300 bg-white"}`}>
          Aplicar período
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faturamento locações" value={money(d.rentalRevenue)} hint={`${d.rentals.length} locação(ões) com saída no período`} tone="accent" />
        <Stat label="Faturamento vendas" value={money(d.saleRevenue)} hint={`${d.sales.filter((s) => s.status === "CONCLUIDA").length} venda(s)`} tone="ok" />
        <Stat label="Movimentações" value={d.movements.length} />
        <Stat label="Perdas/danos" value={d.losses.reduce((s, m) => s + m.quantity, 0)} tone={d.losses.length ? "danger" : "neutral"} hint="itens no período" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block qs={qs} title="Produtos mais alugados" tipo="mais-alugados">
          <DataTable
            rows={d.topRented}
            rowKey={(r) => r.productId}
            rowHref={(r) => `/admin/produtos/${r.productId}`}
            empty="Sem locações no período."
            columns={[
              { header: "Produto", mobile: "title", cell: (r) => r.name },
              { header: "Qtd.", align: "right", cell: (r) => r.qty },
              { header: "Locações", align: "right", cell: (r) => r.rentals },
              { header: "Faturamento", align: "right", cell: (r) => money(r.revenue) },
            ]}
          />
        </Block>
        <Block qs={qs} title="Produtos mais vendidos" tipo="mais-vendidos">
          <DataTable
            rows={d.topSold}
            rowKey={(r) => r.productId}
            rowHref={(r) => `/admin/produtos/${r.productId}`}
            empty="Sem vendas no período."
            columns={[
              { header: "Produto", mobile: "title", cell: (r) => r.name },
              { header: "Qtd.", align: "right", cell: (r) => r.qty },
              { header: "Faturamento", align: "right", cell: (r) => money(r.revenue) },
            ]}
          />
        </Block>
      </div>

      <Block qs={qs} title={`Locações por período (${d.rentals.length})`} tipo="locacoes">
        <DataTable
          rows={d.rentals}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/locacoes/${r.id}`}
          empty="Nenhuma locação com saída no período."
          columns={[
            { header: "Locação", mobile: "title", cell: (r) => <>#{seq(r.number)} — {r.eventName}</> },
            { header: "Cliente", cell: (r) => r.customer.name },
            { header: "Saída", cell: (r) => fmtDateTime(r.departureAt) },
            { header: "Status", cell: (r) => <RentalStatusBadge rental={r} /> },
            { header: "Valor", align: "right", cell: (r) => money(r.totalCents) },
          ]}
        />
      </Block>

      <Block qs={qs} title={`Vendas por período (${d.sales.length})`} tipo="vendas">
        <DataTable
          rows={d.sales}
          rowKey={(s) => s.id}
          rowHref={(s) => `/admin/vendas/${s.id}`}
          empty="Nenhuma venda no período."
          columns={[
            { header: "Venda", mobile: "title", cell: (s) => <>#{seq(s.number)} — {s.customer?.name ?? s.customerName ?? "Avulsa"}</> },
            { header: "Data", cell: (s) => fmtDateTime(s.soldAt) },
            { header: "Produtos", cell: (s) => s.items.map((i) => `${i.quantity} ${i.product.name}`).join(", ") },
            { header: "Valor", align: "right", cell: (s) => (s.status === "CANCELADA" ? "Cancelada" : money(s.totalCents)) },
          ]}
        />
      </Block>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block qs={qs} title="Movimentação de estoque (resumo)" tipo="movimentacoes">
          <DataTable
            rows={d.movementSummary}
            rowKey={(m) => m.type}
            empty="Nenhuma movimentação no período."
            columns={[
              { header: "Operação", mobile: "title", cell: (m) => m.label },
              { header: "Registros", align: "right", cell: (m) => m.count },
              { header: "Itens", align: "right", cell: (m) => m.qty },
            ]}
          />
        </Block>
        <Block qs={qs} title="Clientes" tipo="clientes">
          <DataTable
            rows={d.customers.slice(0, 15)}
            rowKey={(c) => c.key}
            empty="Sem clientes no período."
            columns={[
              { header: "Cliente", mobile: "title", cell: (c) => c.name },
              { header: "Locações", align: "right", cell: (c) => c.rentals },
              { header: "Compras", align: "right", cell: (c) => c.sales },
              { header: "Total", align: "right", cell: (c) => money(c.total) },
            ]}
          />
        </Block>
        <Block qs={qs} title="Produtos em manutenção (agora)" tipo="manutencao">
          <DataTable
            rows={d.maintenanceOpen}
            rowKey={(m) => m.id}
            empty="Nenhum item em manutenção."
            columns={[
              { header: "Produto", mobile: "title", cell: (m) => `${m.product.name}${m.unit ? ` #${m.unit.code}` : ""}` },
              { header: "Qtd.", align: "right", cell: (m) => m.quantity },
              { header: "Motivo", cell: (m) => m.reason },
              { header: "Desde", cell: (m) => fmtDateTime(m.openedAt) },
            ]}
          />
        </Block>
        <Block qs={qs} title={`Contratos emitidos (${d.contracts.length})`} tipo="contratos">
          <DataTable
            rows={d.contracts}
            rowKey={(c) => c.id}
            empty="Nenhum contrato emitido no período."
            columns={[
              { header: "Contrato", mobile: "title", cell: (c) => <Link href={`/admin/contratos/${c.id}`} className="underline">#{seq(c.number)}</Link> },
              { header: "Cliente", cell: (c) => c.customer.name },
              { header: "Situação", cell: (c) => <ContractStatusBadge contract={c} /> },
              { header: "Assinaturas", align: "right", cell: (c) => `${c.signatures.length}/2` },
            ]}
          />
        </Block>
        <Block qs={qs} title={`Ocorrências de danos (${d.damages.length})`} tipo="danos">
          <DataTable
            rows={d.damages}
            rowKey={(x) => x.id}
            empty="Nenhum dano registrado no período."
            columns={[
              { header: "Produto", mobile: "title", cell: (x) => x.product.name },
              { header: "Tipo", cell: (x) => x.damageType },
              { header: "Qtd.", align: "right", cell: (x) => x.quantity },
              { header: "Locação", cell: (x) => `#${seq(x.rental.number)}` },
              { header: "Responsável", cell: (x) => x.responsible ?? "—" },
            ]}
          />
        </Block>
        <Block qs={qs} title="Produtos perdidos / danificados" tipo="perdas">
          <DataTable
            rows={d.losses}
            rowKey={(m) => m.id}
            empty="Nenhuma perda ou dano no período."
            columns={[
              { header: "Produto", mobile: "title", cell: (m) => m.product.name },
              { header: "Ocorrência", cell: (m) => MOVEMENT_LABEL[m.type] },
              { header: "Qtd.", align: "right", cell: (m) => m.quantity },
              { header: "Data", cell: (m) => fmtDateTime(m.occurredAt) },
            ]}
          />
        </Block>
      </div>
    </div>
  );
}
