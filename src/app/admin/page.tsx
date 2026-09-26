import type { Metadata } from "next";
import Link from "next/link";
import { RentalMiniList } from "@/components/rentals/RentalMiniList";
import { Icon, type IconName } from "@/components/ui/icons";
import { EmptyState, Notice, Section, Stat } from "@/components/ui/primitives";
import { fmtDateTime, fmtLongDate, fmtWeekday, plural, seq } from "@/lib/format";
import { TZ, zonedParts } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { dashboardData } from "@/server/queries";

export const metadata: Metadata = { title: "Painel" };

function QuickAction({ href, icon, label, primary, kbd }: { href: string; icon: IconName; label: string; primary?: boolean; kbd?: string }) {
  return (
    <Link
      href={href}
      className={`relative flex min-h-14 items-center gap-2.5 rounded-lg border px-3 py-3 text-sm font-semibold transition active:scale-[0.99] ${
        primary ? "border-ink bg-ink text-white hover:bg-ink-soft" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
      }`}
    >
      <Icon name={icon} className={`h-5 w-5 ${primary ? "text-white" : "text-zinc-500"}`} />
      {label}
      {kbd ? (
        <kbd className={`absolute right-2 top-2 hidden rounded px-1 font-mono text-[10px] lg:block ${primary ? "bg-white/15 text-white/80" : "bg-zinc-100 text-zinc-400"}`}>{kbd}</kbd>
      ) : null}
    </Link>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ negado?: string }> }) {
  const user = await requireUser();
  const { negado } = await searchParams;
  const d = await dashboardData();
  const now = new Date();
  const hour = zonedParts(now, TZ).hour;
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const alerts: Array<{ tone: "danger" | "warn" | "info"; text: string; href: string }> = [];
  if (d.overdue.length) alerts.push({ tone: "danger", text: `${plural(d.overdue.length, "locação está atrasada", "locações estão atrasadas")}.`, href: "/admin/locacoes?aba=atrasadas" });
  if (d.returnsToday.length) alerts.push({ tone: "warn", text: `${plural(d.returnsToday.length, "locação precisa", "locações precisam")} retornar hoje.`, href: "/admin/retorno" });
  if (d.departuresToday.length) alerts.push({ tone: "warn", text: `${plural(d.departuresToday.length, "locação precisa", "locações precisam")} sair hoje.`, href: "/admin/locacoes?aba=saidas" });
  if (d.awaitingCheck.length) alerts.push({ tone: "warn", text: `${plural(d.awaitingCheck.length, "locação retornou e aguarda", "locações retornaram e aguardam")} conferência.`, href: "/admin/retorno" });
  for (const p of d.lowStock.slice(0, 3)) {
    alerts.push({ tone: "warn", text: `${p.name} está com apenas ${plural(p.free, "unidade disponível", "unidades disponíveis")}.`, href: `/admin/produtos/${p.id}` });
  }
  if (d.lowStock.length > 3) alerts.push({ tone: "warn", text: `Mais ${d.lowStock.length - 3} produtos com estoque baixo.`, href: "/admin/produtos?filtro=baixo" });
  if (d.totals.maintenance) alerts.push({ tone: "info", text: `${plural(d.totals.maintenance, "produto está", "produtos estão")} em manutenção.`, href: "/admin/manutencao" });
  if (d.totals.pending) alerts.push({ tone: "info", text: `${plural(d.totals.pending, "item faltante", "itens faltantes")} de locações (pendências).`, href: "/admin/manutencao#pendencias" });
  if (d.tomorrowDepartures.length) alerts.push({ tone: "info", text: `${plural(d.tomorrowDepartures.length, "locação sairá", "locações sairão")} amanhã.`, href: "/admin/calendario?view=dia" });

  return (
    <div className="space-y-6">
      {negado ? <Notice tone="danger">Você não tem permissão para acessar aquela área.</Notice> : null}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {greeting}, {user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-zinc-500">
          Hoje, {fmtWeekday(now)}, {fmtLongDate(now)}
        </p>
      </header>

      <section aria-label="Estoque">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Disponível" value={d.totals.free} tone="ok" href="/admin/produtos" hint="livre para uso agora" />
          <Stat label="Reservado" value={d.totals.reserved} tone="info" href="/admin/locacoes?aba=reservas" hint="aguardando saída" />
          <Stat label="Em locação" value={d.totals.rented} tone="accent" href="/admin/locacoes?aba=fora" hint="fora da empresa" />
          <Stat label="Manutenção" value={d.totals.maintenance} tone="warn" href="/admin/manutencao" hint={plural(d.openMaintenance, "registro aberto", "registros abertos")} />
          <Stat
            label="Atrasado"
            value={d.overdueUnits}
            tone={d.overdueUnits ? "danger" : "neutral"}
            href="/admin/locacoes?aba=atrasadas"
            hint={plural(d.overdue.length, "locação atrasada", "locações atrasadas")}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Total de {d.totals.total} itens em {plural(d.totals.products, "produto", "produtos")} · {d.totals.sold} vendidos ·{" "}
          {plural(d.totals.pending, "pendência", "pendências")} de faltantes
          {d.lowStock.length ? (
            <>
              {" · "}
              <Link href="/admin/produtos?filtro=baixo" className="font-medium text-red-700 underline">
                {plural(d.lowStock.length, "produto", "produtos")} com estoque baixo
              </Link>
            </>
          ) : null}
        </p>
      </section>

      <section aria-label="Ações rápidas">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <QuickAction href="/admin/locacoes/nova" icon="tent" label="+ Nova locação" primary kbd="N" />
          <QuickAction href="/admin/vendas/nova" icon="cart" label="+ Nova venda" />
          <QuickAction href="/admin/clientes/novo" icon="users" label="+ Novo cliente" kbd="C" />
          <QuickAction href="/admin/estoque/entrada" icon="arrowIn" label="+ Entrada" kbd="E" />
          <QuickAction href="/admin/estoque/saida" icon="arrowOut" label="+ Saída" kbd="S" />
          <QuickAction href="/admin/retorno" icon="undo" label="+ Retorno" kbd="R" />
          <QuickAction href="/admin/contratos/novo" icon="clipboard" label="+ Novo contrato" />
        </div>
      </section>

      {d.contractsToGenerate.length || d.contractsAwaiting.length || d.openQuotes ? (
        <Section title="O que fazer agora" padded={false}>
          <ul className="divide-y divide-zinc-100 text-sm">
            {d.contractsToGenerate.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/admin/locacoes/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="min-w-0">
                    <span className="font-medium text-zinc-900">Gerar contrato</span> · #{seq(r.number)} {r.eventName}
                    <span className="block truncate text-xs text-zinc-500">
                      {r.customer.name} · saída {fmtDateTime(r.departureAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-ink">Abrir →</span>
                </Link>
              </li>
            ))}
            {d.contractsAwaiting.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/admin/contratos/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span className="min-w-0">
                    <span className="font-medium text-zinc-900">Colher assinatura</span> · contrato #{seq(c.number)}
                    <span className="block truncate text-xs text-zinc-500">
                      {c.customer.name}
                      {c.rental ? ` · saída ${fmtDateTime(c.rental.departureAt)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-ink">Abrir →</span>
                </Link>
              </li>
            ))}
            {d.openQuotes ? (
              <li>
                <Link href="/admin/locacoes?aba=orcamentos" className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                  <span>
                    <span className="font-medium text-zinc-900">{plural(d.openQuotes, "orçamento aguardando", "orçamentos aguardando")}</span> aprovação do cliente
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-ink">Ver →</span>
                </Link>
              </li>
            ) : null}
          </ul>
        </Section>
      ) : null}

      {alerts.length ? (
        <section aria-label="Alertas" className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Alertas</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {alerts.map((a, i) => (
              <li key={i}>
                <Link
                  href={a.href}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${
                    a.tone === "danger"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : a.tone === "warn"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-zinc-200 bg-white text-zinc-700"
                  }`}
                >
                  <Icon name={a.tone === "info" ? "clock" : "alert"} className="h-4 w-4 shrink-0" />
                  {a.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Saídas de hoje (${d.departuresToday.length})`} padded={false}>
          <RentalMiniList
            rentals={d.departuresToday}
            when="departure"
            empty="Nenhuma saída prevista para hoje."
            action={{ label: "Registrar saída", href: (id) => `/admin/locacoes/${id}/saida` }}
          />
        </Section>
        <Section title={`Retornos de hoje (${d.returnsToday.length})`} padded={false}>
          <RentalMiniList
            rentals={d.returnsToday}
            when="return"
            empty="Nenhum retorno previsto para hoje."
            action={{ label: "Conferir", href: (id) => `/admin/locacoes/${id}/conferencia` }}
          />
        </Section>
        <Section title={`Locações atrasadas (${d.overdue.length})`} padded={false}>
          <RentalMiniList
            rentals={d.overdue}
            when="return"
            empty="Nenhuma locação atrasada."
            action={{ label: "Conferir", href: (id) => `/admin/locacoes/${id}/conferencia` }}
          />
        </Section>
        <Section title={`Acontecendo hoje (${d.happeningToday.length})`} padded={false}>
          <RentalMiniList rentals={d.happeningToday} when="event" empty="Nenhuma locação em andamento hoje." />
        </Section>
        <Section title={`Estoque baixo (${d.lowStock.length})`} padded={false}>
          {d.lowStock.length === 0 ? (
            <EmptyState>Nenhum produto abaixo do mínimo.</EmptyState>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {d.lowStock.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/produtos/${p.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50">
                    <span className="font-medium text-zinc-900">{p.name}</span>
                    <span className="tabular text-red-700">
                      {p.free} disp. <span className="text-zinc-400">/ mín. {p.minStock}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={`Saídas de amanhã (${d.tomorrowDepartures.length})`} padded={false}>
          <RentalMiniList rentals={d.tomorrowDepartures} when="departure" empty="Nenhuma saída prevista para amanhã." />
        </Section>
      </div>
    </div>
  );
}
