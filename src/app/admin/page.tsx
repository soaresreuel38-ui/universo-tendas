import type { Metadata } from "next";
import { FirstSteps } from "@/components/operations/FirstSteps";
import { can } from "@/lib/domain";
import Link from "next/link";
import { AgendaTimeline, buildAgenda } from "@/components/operations/Agenda";
import { AlertList, operationalAlerts } from "@/components/operations/Alerts";
import { ProductImage } from "@/components/products/ProductImage";
import { StockBar } from "@/components/stock/StockBar";
import { Icon, type IconName } from "@/components/ui/icons";
import { LinkButton, Notice, Section, Stat, StatStrip } from "@/components/ui/primitives";
import { fmtLongDate, fmtTime, fmtWeekday, money, plural } from "@/lib/format";
import { TZ, zonedParts } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { dashboardData } from "@/server/queries";

export const metadata: Metadata = { title: "Painel" };

function Quick({ href, icon, label, kbd }: { href: string; icon: IconName; label: string; kbd?: string }) {
  return (
    <Link
      href={href}
      className="group flex h-11 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 text-[13.5px] font-medium text-graphite transition-colors hover:border-line-strong hover:bg-paper"
    >
      <Icon name={icon} className="h-[17px] w-[17px] text-ink" />
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {kbd ? <kbd className="hidden rounded border border-line px-1 font-mono text-[10.5px] text-faint lg:inline">{kbd}</kbd> : null}
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
  const agenda = buildAgenda(d, now);
  const alerts = operationalAlerts({ ...d, maintenanceUnits: d.totals.maintenance, lowStock: d.lowStock.length }, money, now);
  // Produtos com mais movimento primeiro (fora + reservados), para o bloco de estoque.
  const stockTop = [...d.stock].sort((a, b) => b.qtyRented + b.reserved - (a.qtyRented + a.reserved) || a.name.localeCompare(b.name)).slice(0, 6);

  return (
    <div className="space-y-8">
      {negado ? <Notice tone="danger">Você não tem permissão para acessar aquela área.</Notice> : null}

      <header className="flex animate-rise flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow mb-1.5">
            Hoje, {fmtWeekday(now)} · {fmtLongDate(now)}
          </p>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-graphite md:text-[34px]">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {agenda.length ? `${plural(agenda.length, "compromisso", "compromissos")} na agenda de hoje.` : "Nenhum compromisso na agenda de hoje."}
          </p>
        </div>
        <LinkButton href="/admin/locacoes/nova" variant="primary" size="lg" icon="plus" className="lg:px-6">
          Nova locação
        </LinkButton>
      </header>

      <FirstSteps isAdmin={can(user.role, "settings.manage")} />

      <section aria-label="Ações rápidas" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-max grid-cols-6 gap-2 sm:min-w-0 sm:grid-cols-3 xl:grid-cols-6">
          <Quick href="/admin/vendas/nova" icon="cart" label="+ Nova venda" />
          <Quick href="/admin/clientes/novo" icon="users" label="+ Novo cliente" kbd="C" />
          <Quick href="/admin/contratos/novo" icon="clipboard" label="+ Novo contrato" />
          <Quick href="/admin/estoque/entrada" icon="arrowIn" label="+ Entrada" kbd="E" />
          <Quick href="/admin/estoque/saida" icon="arrowOut" label="+ Saída" kbd="S" />
          <Quick href="/admin/retorno" icon="undo" label="+ Retorno" kbd="R" />
        </div>
      </section>

      <section aria-label="Estoque agora" className="animate-rise [animation-delay:60ms]">
        <StatStrip cols={5}>
          <Stat label="Disponível" value={d.totals.free} tone="ok" href="/admin/estoque" hint="livre para uso agora" />
          <Stat label="Reservado" value={d.totals.reserved} tone="info" href="/admin/locacoes?aba=reservas" hint="aguardando saída" />
          <Stat label="Em locação" value={d.totals.rented} tone="accent" href="/admin/locacoes?aba=fora" hint="fora da empresa" />
          <Stat label="Manutenção" value={d.totals.maintenance} tone="neutral" href="/admin/manutencao" hint={plural(d.openMaintenance, "registro aberto", "registros abertos")} />
          <Stat label="Atrasado" value={d.overdueUnits} tone="danger" href="/admin/locacoes?aba=atrasadas" hint={plural(d.overdue.length, "locação", "locações")} />
        </StatStrip>
      </section>

      <div className="grid animate-rise gap-6 [animation-delay:120ms] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Section
          title="Agenda de hoje"
          padded={false}
          actions={
            <Link href="/admin/hoje" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
              Centro operacional <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <div className="px-2 sm:px-3">
            <AgendaTimeline entries={agenda.slice(0, 8)} empty="Nenhuma saída, montagem ou devolução hoje." />
          </div>
          {agenda.length > 8 ? (
            <Link href="/admin/hoje" className="block border-t border-line px-5 py-3 text-center text-[13px] font-medium text-ink hover:bg-paper">
              Ver mais {agenda.length - 8} na agenda completa
            </Link>
          ) : null}
        </Section>

        <div className="space-y-6">
          <Section title="Atenção" padded={false}>
            <AlertList items={alerts} />
          </Section>
          {d.tomorrowDepartures.length ? (
            <Section title="Amanhã" padded={false}>
              <ul className="divide-y divide-line/70">
                {d.tomorrowDepartures.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/locacoes/${r.id}`} className="block px-5 py-3 hover:bg-paper">
                      <span className="block truncate text-sm font-medium text-graphite">{r.customer.name}</span>
                      <span className="block truncate text-xs text-faint">
                        Saída {fmtTime(r.departureAt)} · {r.eventName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      </div>

      <Section
        title="Estoque por produto"
        padded={false}
        actions={
          <Link href="/admin/estoque" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
            <span className="sm:hidden">Ver tudo</span>
            <span className="max-sm:hidden">Ver estoque completo</span> <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {stockTop.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted">
            Nenhum produto cadastrado ainda.{" "}
            <Link href="/admin/produtos/novo" className="font-medium text-ink underline">
              Cadastrar o primeiro
            </Link>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 xl:grid-cols-3">
            {stockTop.map((p) => (
              <li key={p.id} className="border-b border-line/70 sm:border-r">
                <Link href={`/admin/produtos/${p.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
                    <ProductImage photoId={p.photoId} name={p.name} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-graphite group-hover:text-ink">{p.name}</span>
                      <span className="tabular shrink-0 text-sm font-semibold text-graphite">
                        {p.free}
                        <span className="font-normal text-faint">/{p.total}</span>
                      </span>
                    </span>
                    <StockBar className="mt-2" thin parts={{ free: p.free, reserved: p.reserved, rented: p.qtyRented, maintenance: p.qtyMaintenance }} />
                    <span className="mt-1.5 block font-mono text-[11px] text-faint">{p.sku}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
