import type { Metadata } from "next";
import Link from "next/link";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { RentalMiniList } from "@/components/rentals/RentalMiniList";
import { EmptyState, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDateTime, fmtLongDate, fmtWeekday, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { todayOperations } from "@/server/queries";

export const metadata: Metadata = { title: "Hoje" };

const tabs = [
  { key: "saidas", label: "Saídas" },
  { key: "retornos", label: "Retornos" },
  { key: "montagens", label: "Montagens" },
  { key: "desmontagens", label: "Desmontagens" },
  { key: "contratos", label: "Contratos" },
  { key: "atrasados", label: "Atrasados" },
] as const;

export default async function TodayPage() {
  await requireUser();
  const now = new Date();
  const d = await todayOperations(now);
  const counts: Record<(typeof tabs)[number]["key"], number> = {
    saidas: d.departures.length,
    retornos: d.returns.length + d.awaitingCheck.length,
    montagens: d.setups.length,
    desmontagens: d.teardowns.length,
    contratos: d.contractsToGenerate.length + d.contractsAwaiting.length,
    atrasados: d.overdue.length,
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Hoje" description={`${fmtWeekday(now)}, ${fmtLongDate(now)}`} />

      <nav aria-label="Seções de hoje" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`#${t.key}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
              t.key === "atrasados" && counts.atrasados ? "border-red-200 bg-red-50 text-red-800" : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            {t.label} <span className="tabular text-zinc-400">{counts[t.key]}</span>
          </a>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section id="saidas" title={`Saídas (${d.departures.length})`} padded={false}>
          <RentalMiniList
            rentals={d.departures}
            when="departure"
            empty="Nenhuma saída para hoje."
            action={{ label: "Saída", href: (id) => `/admin/locacoes/${id}/saida` }}
          />
        </Section>
        <Section id="retornos" title={`Retornos (${d.returns.length + d.awaitingCheck.length})`} padded={false}>
          <RentalMiniList
            rentals={[...d.awaitingCheck, ...d.returns]}
            when="return"
            empty="Nenhum retorno para hoje."
            action={{ label: "Conferir", href: (id) => `/admin/locacoes/${id}/conferencia` }}
          />
        </Section>
        <Section id="montagens" title={`Montagens (${d.setups.length})`} padded={false}>
          <RentalMiniList rentals={d.setups} when="setup" empty="Nenhuma montagem agendada para hoje." />
        </Section>
        <Section id="desmontagens" title={`Desmontagens (${d.teardowns.length})`} padded={false}>
          <RentalMiniList rentals={d.teardowns} when="teardown" empty="Nenhuma desmontagem agendada para hoje." />
        </Section>
        <Section id="contratos" title={`Contratos pendentes (${counts.contratos})`} padded={false}>
          {counts.contratos === 0 ? (
            <EmptyState>Nenhum contrato pendente.</EmptyState>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {d.contractsToGenerate.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/locacoes/${r.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                    <span className="font-medium">Gerar contrato</span> · #{seq(r.number)} {r.eventName}
                    <span className="block text-xs text-zinc-500">
                      {r.customer.name} · saída {fmtDateTime(r.departureAt)}
                    </span>
                  </Link>
                </li>
              ))}
              {d.contractsAwaiting.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/contratos/${c.id}`} className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-zinc-50">
                    <span>
                      <span className="font-medium">Contrato #{seq(c.number)}</span> · {c.customer.name}
                      {c.rental ? <span className="block text-xs text-zinc-500">saída {fmtDateTime(c.rental.departureAt)}</span> : null}
                    </span>
                    <ContractStatusBadge contract={c} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section id="atrasados" title={`Atrasados (${d.overdue.length})`} padded={false}>
          <RentalMiniList
            rentals={d.overdue}
            when="return"
            empty="Nada atrasado."
            action={{ label: "Conferir", href: (id) => `/admin/locacoes/${id}/conferencia` }}
          />
        </Section>
      </div>
    </div>
  );
}
