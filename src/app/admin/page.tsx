import type { Metadata } from "next";
import Link from "next/link";
import { RentalMiniList } from "@/components/rentals/RentalMiniList";
import { Icon, type IconName } from "@/components/ui/icons";
import { EmptyState, Notice, Section, Stat } from "@/components/ui/primitives";
import { can } from "@/lib/domain";
import { fmtLongDate, fmtWeekday, plural } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { dashboardData } from "@/server/queries";

export const metadata: Metadata = { title: "Painel" };

function QuickAction({ href, icon, label, primary }: { href: string; icon: IconName; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-3 text-sm font-semibold uppercase tracking-wide transition active:scale-[0.99] ${
        primary ? "border-ink bg-ink text-white hover:bg-ink-soft" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300"
      }`}
    >
      <Icon name={icon} className={`h-5 w-5 ${primary ? "text-accent" : "text-zinc-500"}`} />
      {label}
    </Link>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ negado?: string }> }) {
  const user = await requireUser();
  const { negado } = await searchParams;
  const d = await dashboardData();
  const now = new Date();

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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Universo Tendas</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Olá, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-zinc-500">
          Hoje — {fmtWeekday(now).replace(/^./, (c) => c.toUpperCase())}, {fmtLongDate(now)}
        </p>
      </header>

      <section aria-label="Estoque">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Estoque</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Disponíveis" value={d.totals.free} tone="ok" href="/admin/produtos" hint="livres para uso agora" />
          <Stat label="Alugados" value={d.totals.rented} tone="accent" href="/admin/locacoes?aba=fora" hint="fora da empresa" />
          <Stat label="Reservados" value={d.totals.reserved} tone="info" href="/admin/locacoes?aba=reservas" hint="aguardando saída" />
          <Stat label="Manutenção" value={d.totals.maintenance} tone="warn" href="/admin/manutencao" hint={`${plural(d.openMaintenance, "registro aberto", "registros abertos")}`} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total de itens" value={d.totals.total} hint={`${plural(d.totals.products, "produto cadastrado", "produtos cadastrados")}`} href="/admin/produtos" />
          <Stat label="Vendidos" value={d.totals.sold} href="/admin/vendas" hint="acumulado" />
          <Stat label="Pendências" value={d.totals.pending} tone={d.totals.pending ? "danger" : "neutral"} href="/admin/manutencao#pendencias" hint="faltantes de locações" />
          <Stat label="Estoque baixo" value={d.lowStock.length} tone={d.lowStock.length ? "danger" : "neutral"} href="/admin/produtos?filtro=baixo" hint="produtos no mínimo" />
        </div>
      </section>

      <section aria-label="Ações rápidas">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Ações rápidas</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <QuickAction href="/admin/estoque/entrada" icon="arrowIn" label="+ Entrada" />
          <QuickAction href="/admin/estoque/saida" icon="arrowOut" label="− Saída" />
          <QuickAction href="/admin/locacoes/nova" icon="tent" label="Nova locação" primary />
          <QuickAction href="/admin/vendas/nova" icon="cart" label="Nova venda" />
          <QuickAction href="/admin/retorno" icon="undo" label="Retorno" />
          {can(user.role, "product.manage") ? <QuickAction href="/admin/produtos/novo" icon="plus" label="Novo produto" /> : null}
        </div>
      </section>

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
