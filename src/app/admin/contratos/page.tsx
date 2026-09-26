import type { Metadata } from "next";
import Link from "next/link";
import type { ContractStatus, Prisma } from "@prisma/client";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { DataTable, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Contratos" };

const TABS: Array<{ key: string; label: string; where: Prisma.ContractWhereInput }> = [
  { key: "abertos", label: "Pendentes", where: { status: { in: ["RASCUNHO", "ENVIADO", "AGUARDANDO_ASSINATURA"] } } },
  { key: "assinatura", label: "Aguardando assinatura", where: { status: { in: ["ENVIADO", "AGUARDANDO_ASSINATURA"] } } },
  { key: "assinados", label: "Assinados / ativos", where: { status: { in: ["ASSINADO", "ATIVO"] } } },
  { key: "finalizados", label: "Finalizados", where: { status: "FINALIZADO" as ContractStatus } },
  { key: "cancelados", label: "Cancelados", where: { status: "CANCELADO" as ContractStatus } },
  { key: "todos", label: "Todos", where: {} },
];

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.aba) ?? TABS[0];
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const num = Number(q.replace(/\D/g, ""));
  const contracts = await prisma.contract.findMany({
    where: {
      ...tab.where,
      ...(q
        ? {
            OR: [
              { customer: { name: { contains: q, mode: "insensitive" } } },
              { customer: { document: { contains: q } } },
              { rental: { eventName: { contains: q, mode: "insensitive" } } },
              ...(num ? [{ number: num }] : []),
            ],
          }
        : {}),
    },
    include: { customer: { select: { name: true } }, rental: { select: { number: true, eventName: true, departureAt: true, departedAt: true, totalCents: true } } },
    orderBy: { number: "desc" },
    take: 300,
  });
  const pendingRentals = await prisma.rental.count({
    where: { status: { in: ["ORCAMENTO", "RESERVADA", "CONFIRMADA", "SEPARACAO"] }, contracts: { none: { status: { not: "CANCELADO" } } } },
  });

  return (
    <div>
      <PageHeader
        title="Contratos"
        description="Gerados a partir das locações — sem redigitar dados."
        actions={<LinkButton href="/admin/contratos/novo" variant="primary" icon="plus">Novo contrato</LinkButton>}
      />
      {pendingRentals ? (
        <Link href="/admin/contratos/novo" className="mb-4 flex items-center justify-between rounded-lg bg-ink px-4 py-3 text-sm text-white">
          <span>
            <b>{pendingRentals}</b> locação(ões) ainda sem contrato
          </span>
          <span className="font-medium underline">Gerar agora</span>
        </Link>
      ) : null}
      <nav className="-mx-4 mb-3 overflow-x-auto px-4" aria-label="Filtros">
        <ul className="flex gap-1.5 whitespace-nowrap">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin/contratos?aba=${t.key}`}
                className={`inline-block rounded-full border px-3 py-1.5 text-sm ${t.key === tab.key ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form className="mb-3 flex gap-2" role="search">
        <input type="hidden" name="aba" value={tab.key} />
        <input name="q" defaultValue={q} type="search" placeholder="Nº, cliente, CPF/CNPJ ou evento" className="h-10 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm" />
        <button className="h-10 rounded-md bg-ink px-4 text-sm font-medium text-white">Buscar</button>
      </form>
      <Section padded={false}>
        <DataTable
          rows={contracts}
          rowKey={(c) => c.id}
          rowHref={(c) => `/admin/contratos/${c.id}`}
          empty="Nenhum contrato nesta lista."
          columns={[
            { header: "Contrato", mobile: "title", cell: (c) => <>#{seq(c.number)} — {c.customer.name}</> },
            { header: "Evento", cell: (c) => (c.rental ? `${c.rental.eventName} (#${seq(c.rental.number)})` : "—") },
            { header: "Saída", cell: (c) => fmtDateTime(c.rental?.departureAt) },
            { header: "Valor", align: "right", cell: (c) => money(c.rental?.totalCents) },
            { header: "Status", cell: (c) => <ContractStatusBadge contract={c} /> },
          ]}
        />
      </Section>
    </div>
  );
}
