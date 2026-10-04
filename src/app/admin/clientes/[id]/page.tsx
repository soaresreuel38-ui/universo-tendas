import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { ActionForm } from "@/components/ui/forms";
import { Icon } from "@/components/ui/icons";
import { Badge, DataTable, LinkButton, PageHeader, Section, Stat } from "@/components/ui/primitives";
import { can } from "@/lib/domain";
import { fmtDateTime, money, seq, whatsappLink } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { deleteCustomerAction, saveCustomerAction } from "../actions";
import { CustomerForm } from "../CustomerForm";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      rentals: { include: { items: { include: { product: { select: { id: true, name: true } } } } }, orderBy: { departureAt: "desc" } },
      sales: { include: { items: { include: { product: { select: { name: true } } } } }, orderBy: { soldAt: "desc" } },
    },
  });
  if (!c) notFound();
  const now = new Date();
  const valid = c.rentals.filter((r) => r.status !== "CANCELADA" && r.status !== "ORCAMENTO");
  const future = c.rentals.filter((r) => r.departureAt >= now && r.status !== "CANCELADA");
  const past = c.rentals.filter((r) => !future.includes(r));
  const rentalTotal = valid.reduce((s, r) => s + r.totalCents, 0);
  const salesTotal = c.sales.filter((s) => s.status === "CONCLUIDA").reduce((s, x) => s + x.totalCents, 0);
  const products = new Map<string, { name: string; qty: number }>();
  for (const r of valid) for (const i of r.items) products.set(i.product.id, { name: i.product.name, qty: (products.get(i.product.id)?.qty ?? 0) + i.quantity });
  const wa = whatsappLink(c.whatsapp || c.phone);

  const rentalColumns = [
    { header: "Locação", mobile: "title" as const, cell: (r: (typeof c.rentals)[number]) => <>#{seq(r.number)} — {r.eventName}</> },
    { header: "Saída", cell: (r: (typeof c.rentals)[number]) => fmtDateTime(r.departureAt) },
    { header: "Produtos", cell: (r: (typeof c.rentals)[number]) => <span className="text-muted">{r.items.map((i) => `${i.quantity} ${i.product.name}`).join(", ")}</span> },
    { header: "Valor", align: "right" as const, cell: (r: (typeof c.rentals)[number]) => money(r.totalCents) },
    { header: "Status", cell: (r: (typeof c.rentals)[number]) => <RentalStatusBadge rental={r} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/admin/clientes", label: "Clientes" }}
        title={<span className="flex items-center gap-2">{c.name} {!c.active ? <Badge tone="muted">Desativado</Badge> : null}</span>}
        description={[c.personType === "PJ" ? "Pessoa jurídica" : null, c.tradeName, c.contactName ? `Resp.: ${c.contactName}` : null, c.phone, c.document, c.email].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-white px-4 text-sm font-medium">
                <Icon name="whatsapp" className="h-4 w-4 text-emerald-600" /> WhatsApp
              </a>
            ) : null}
            <LinkButton href={`/admin/locacoes/nova?cliente=${c.id}`} variant="primary" icon="plus">Nova locação</LinkButton>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Locações" value={valid.length} />
        <Stat label="Próximas" value={future.length} tone="info" />
        <Stat label="Total em locações" value={money(rentalTotal)} />
        <Stat label="Total em compras" value={money(salesTotal)} />
      </div>
      <Section title={`Locações futuras (${future.length})`} padded={false}>
        <DataTable rows={future} rowKey={(r) => r.id} rowHref={(r) => `/admin/locacoes/${r.id}`} columns={rentalColumns} empty="Nenhuma locação futura." />
      </Section>
      <Section title={`Locações anteriores (${past.length})`} padded={false}>
        <DataTable rows={past} rowKey={(r) => r.id} rowHref={(r) => `/admin/locacoes/${r.id}`} columns={rentalColumns} empty="Nenhuma locação anterior." />
      </Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Produtos já alugados">
          {products.size === 0 ? (
            <p className="text-sm text-faint">Nenhum ainda.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...products.entries()].sort((a, b) => b[1].qty - a[1].qty).map(([pid, p]) => (
                <li key={pid} className="flex justify-between">
                  <Link href={`/admin/produtos/${pid}`} className="hover:underline">{p.name}</Link>
                  <span className="tabular text-muted">{p.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={`Compras (${c.sales.length})`} padded={false}>
          <DataTable
            rows={c.sales}
            rowKey={(s) => s.id}
            rowHref={(s) => `/admin/vendas/${s.id}`}
            empty="Nenhuma compra."
            columns={[
              { header: "Venda", mobile: "title", cell: (s) => <>#{seq(s.number)}</> },
              { header: "Data", cell: (s) => fmtDateTime(s.soldAt) },
              { header: "Total", align: "right", cell: (s) => (s.status === "CANCELADA" ? "Cancelada" : money(s.totalCents)) },
            ]}
          />
        </Section>
      </div>
      <Section title="Dados cadastrais">
        <CustomerForm action={saveCustomerAction} initial={c} />
      </Section>
      {can(user.role, "product.manage") && c.active ? (
        <Section title="Excluir cliente">
          <ActionForm action={deleteCustomerAction} submitLabel="Excluir / desativar" submitVariant="danger" confirm="Excluir este cliente? Com histórico, ele será apenas desativado.">
            <input type="hidden" name="id" value={c.id} />
            <p className="text-sm text-faint">Clientes com locações ou compras são desativados para preservar o histórico.</p>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
