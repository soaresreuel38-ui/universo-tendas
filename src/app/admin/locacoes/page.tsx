import type { Metadata } from "next";
import { BILLING_SHORT, periodLabel } from "@/lib/billing";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { DataTable, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { COMMITTING_STATUSES, RENTAL_STATUS_LABEL, RESERVING_STATUSES, type RentalStatus } from "@/lib/domain";
import { fmtDateTime, money, seq } from "@/lib/format";
import { addDays, dayRange, todayKey } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { rentalListInclude } from "@/server/queries";

export const metadata: Metadata = { title: "Locações" };

const OUT = ["SAIU", "EM_EVENTO", "AGUARDANDO_RETORNO", "ATRASADA"] as RentalStatus[];

const TABS = [
  { key: "ativas", label: "Ativas", hint: "Tudo que ainda não terminou" },
  { key: "reservas", label: "Reservas", hint: "O que está reservado" },
  { key: "saidas", label: "A sair", hint: "O que vai sair (hoje e atrasadas)" },
  { key: "fora", label: "Em andamento", hint: "O que está fora" },
  { key: "retornos", label: "Retornos", hint: "O que deveria voltar hoje" },
  { key: "atrasadas", label: "Atrasadas", hint: "Retorno previsto vencido" },
  { key: "orcamentos", label: "Orçamentos", hint: "Não reservam estoque" },
  { key: "encerradas", label: "Encerradas", hint: "Conferidas, finalizadas e canceladas" },
  { key: "todas", label: "Todas", hint: "Todas as locações" },
] as const;

export default async function RentalsPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; status?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.aba)?.key ?? "ativas";
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const now = new Date();
  const today = dayRange(todayKey());

  const byTab: Record<string, Prisma.RentalWhereInput> = {
    ativas: { status: { in: [...COMMITTING_STATUSES, "ORCAMENTO"] } },
    reservas: { status: { in: [...RESERVING_STATUSES] } },
    saidas: { status: { in: [...RESERVING_STATUSES] }, departureAt: { lt: dayRange(addDays(todayKey(), 1)).start } },
    fora: { status: { in: OUT } },
    retornos: { status: { in: [...OUT, "RETORNADA"] }, expectedReturnAt: { lt: today.end } },
    atrasadas: { status: { in: OUT }, expectedReturnAt: { lt: now } },
    orcamentos: { status: "ORCAMENTO" },
    encerradas: { status: { in: ["CONFERIDA", "FINALIZADA", "CANCELADA"] } },
    todas: {},
  };
  const num = Number(q.replace(/\D/g, ""));
  const where: Prisma.RentalWhereInput = {
    ...byTab[tab],
    ...(sp.status && sp.status in RENTAL_STATUS_LABEL ? { status: sp.status as RentalStatus } : {}),
    ...(q
      ? {
          OR: [
            { eventName: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q } } },
            ...(num ? [{ number: num }] : []),
          ],
        }
      : {}),
  };
  const rentals = await prisma.rental.findMany({
    where,
    include: rentalListInclude,
    orderBy: tab === "encerradas" || tab === "todas" ? { departureAt: "desc" } : tab === "retornos" || tab === "fora" || tab === "atrasadas" ? { expectedReturnAt: "asc" } : { departureAt: "asc" },
    take: 300,
  });

  return (
    <div>
      <PageHeader
        hero
        eyebrow="Operação"
        title="Locações"
        description={TABS.find((t) => t.key === tab)?.hint}
        actions={
          <>
            <LinkButton href="/admin/calendario" icon="calendar">Calendário</LinkButton>
            <LinkButton href="/admin/locacoes/nova" variant="primary" icon="plus">Nova locação</LinkButton>
          </>
        }
      />
      <nav className="-mx-4 mb-3 overflow-x-auto px-4" aria-label="Filtros">
        <ul className="flex gap-1.5 whitespace-nowrap">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin/locacoes?aba=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`inline-block rounded-full border px-3 py-1.5 text-sm ${
                  t.key === tab ? "border-graphite bg-graphite text-white" : "border-line-strong bg-white text-muted hover:border-line-strong"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form className="mb-3 flex gap-2" role="search">
        <input type="hidden" name="aba" value={tab} />
        <input name="q" defaultValue={q} type="search" placeholder="Nº, evento, cliente ou telefone" className="h-10 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm" />
        <button className="h-10 rounded-lg bg-graphite px-4 text-sm font-medium text-white hover:bg-black">Buscar</button>
      </form>
      <Section padded={false}>
        <DataTable
          rows={rentals}
          rowKey={(r) => r.id}
          rowHref={(r) => `/admin/locacoes/${r.id}`}
          empty="Nenhuma locação nesta lista."
          columns={[
            {
              header: "Locação",
              mobile: "title",
              cell: (r) => (
                <span>
                  <span className="font-mono text-xs text-faint">#{seq(r.number)}</span> {r.eventName}
                </span>
              ),
            },
            { header: "Cliente", cell: (r) => r.customer.name },
            { header: "Saída", cell: (r) => fmtDateTime(r.departureAt) },
            { header: "Retorno", cell: (r) => fmtDateTime(r.actualReturnAt ?? r.expectedReturnAt) },
            {
              header: "Modalidade",
              cell: (r) => (
                <span className="whitespace-nowrap text-muted">
                  {BILLING_SHORT[r.billingMode]} · {periodLabel(r.billingMode, r.periodCount)}
                </span>
              ),
            },
            {
              header: "Itens",
              mobile: "hide",
              cell: (r) => <span className="text-muted">{r.items.reduce((s, i) => s + i.quantity, 0)} un.</span>,
            },
            { header: "Valor", align: "right", cell: (r) => <span className="tabular">{money(r.totalCents)}</span> },
            { header: "Status", cell: (r) => <RentalStatusBadge rental={r} /> },
          ]}
        />
      </Section>
      {rentals.length === 300 ? <p className="mt-2 text-xs text-faint">Mostrando as 300 primeiras. Use a busca para refinar.</p> : null}
    </div>
  );
}
