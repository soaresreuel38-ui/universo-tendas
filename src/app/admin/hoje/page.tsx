import type { Metadata } from "next";
import Link from "next/link";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { AGENDA_KIND, AgendaTimeline, buildAgenda, type AgendaKind } from "@/components/operations/Agenda";
import { AlertList, operationalAlerts } from "@/components/operations/Alerts";
import { Icon } from "@/components/ui/icons";
import { LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDateTime, fmtWeekday, money, seq } from "@/lib/format";
import { TZ } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { todayOperations } from "@/server/queries";

export const metadata: Metadata = { title: "Hoje" };

const FILTERS: Array<{ key: "tudo" | AgendaKind | "atrasado"; label: string }> = [
  { key: "tudo", label: "Tudo" },
  { key: "saida", label: "Saídas" },
  { key: "retorno", label: "Devoluções" },
  { key: "montagem", label: "Montagens" },
  { key: "desmontagem", label: "Desmontagens" },
  { key: "evento", label: "Eventos" },
  { key: "atrasado", label: "Atrasados" },
];

const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "long" });

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireUser();
  const { f } = await searchParams;
  const now = new Date();
  const [d, maintenance] = await Promise.all([
    todayOperations(now),
    prisma.product.aggregate({ where: { active: true }, _sum: { qtyMaintenance: true } }),
  ]);
  const agenda = buildAgenda(d, now);
  const filter = FILTERS.find((x) => x.key === f)?.key ?? "tudo";
  const count = (k: (typeof FILTERS)[number]["key"]) =>
    k === "tudo" ? agenda.length : k === "atrasado" ? agenda.filter((e) => e.late).length : agenda.filter((e) => e.kind === k || (k === "retorno" && e.kind === "conferencia")).length;
  const shown =
    filter === "tudo"
      ? agenda
      : filter === "atrasado"
        ? agenda.filter((e) => e.late)
        : agenda.filter((e) => e.kind === filter || (filter === "retorno" && e.kind === "conferencia"));
  const alerts = operationalAlerts({ ...d, maintenanceUnits: maintenance._sum.qtyMaintenance ?? 0 }, money, now);

  return (
    <div className="space-y-6">
      <PageHeader
        hero
        eyebrow={`Hoje · ${fmtWeekday(now)}`}
        title={<span className="text-[34px] tracking-[-0.03em] md:text-[44px]">{dayMonth.format(now)}</span>}
        description={agenda.length ? `${agenda.length} ${agenda.length === 1 ? "compromisso" : "compromissos"} na agenda.` : "Agenda livre hoje."}
        actions={
          <>
            <LinkButton href="/admin/calendario?view=semana" icon="calendar">
              Semana
            </LinkButton>
            <LinkButton href="/admin/locacoes/nova" variant="primary" icon="plus">
              Nova locação
            </LinkButton>
          </>
        }
      />

      <nav aria-label="Filtrar agenda" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {FILTERS.map((x) => {
          const n = count(x.key);
          const on = x.key === filter;
          return (
            <Link
              key={x.key}
              href={x.key === "tudo" ? "/admin/hoje" : `/admin/hoje?f=${x.key}`}
              aria-current={on ? "true" : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                on ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-line-strong hover:text-graphite"
              } ${x.key === "atrasado" && n && !on ? "!border-red-200 !text-accent" : ""}`}
            >
              {x.key !== "tudo" && x.key !== "atrasado" ? <span className={`h-1.5 w-1.5 rounded-full ${AGENDA_KIND[x.key].dot}`} aria-hidden /> : null}
              {x.label}
              <span className={`tabular text-[12px] ${on ? "text-white/60" : "text-faint"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Section padded={false} className="animate-rise [animation-delay:60ms]">
          <div className="px-2 py-2 sm:px-3">
            <AgendaTimeline entries={shown} empty={filter === "tudo" ? "Nada agendado para hoje. Aproveite para conferir o estoque." : "Nada deste tipo hoje."} />
          </div>
        </Section>

        <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <Section title="Alertas" padded={false}>
            <AlertList items={alerts} />
          </Section>

          <Section id="contratos" title="Contratos" padded={false}>
            {d.contractsToGenerate.length + d.contractsAwaiting.length === 0 ? (
              <p className="px-5 py-5 text-sm text-muted">Nenhum contrato pendente.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {d.contractsAwaiting.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/contratos/${c.id}`} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-paper">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-graphite">
                          <span className="font-mono text-[12px] text-faint">#{seq(c.number)}</span> {c.customer.name}
                        </span>
                        {c.rental ? <span className="block text-xs text-faint">Saída {fmtDateTime(c.rental.departureAt)}</span> : null}
                      </span>
                      <ContractStatusBadge contract={c} />
                    </Link>
                  </li>
                ))}
                {d.contractsToGenerate.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/locacoes/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-paper">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-graphite">{r.customer.name}</span>
                        <span className="block text-xs text-faint">Reserva #{seq(r.number)} sem contrato</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink">
                        Gerar <Icon name="arrowRight" className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {d.pendingPayments.length ? (
            <Section title="Pagamentos em aberto" padded={false}>
              <ul className="divide-y divide-line/70">
                {d.pendingPayments.slice(0, 5).map(({ rental: r, openCents }) => (
                  <li key={r.id}>
                    <Link href={`/admin/locacoes/${r.id}#pagamentos`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-paper">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-graphite">{r.customer.name}</span>
                        <span className="block font-mono text-[11px] text-faint">#{seq(r.number)}</span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold text-graphite">{money(openCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
