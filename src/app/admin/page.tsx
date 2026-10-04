import type { Metadata } from "next";
import Link from "next/link";
import { TentDrawing } from "@/components/brand/TentDrawing";
import { AgendaTimeline, buildAgenda } from "@/components/operations/Agenda";
import { AlertList, operationalAlerts, type AlertItem } from "@/components/operations/Alerts";
import { ProductImage } from "@/components/products/ProductImage";
import { StockBar } from "@/components/stock/StockBar";
import { Icon, type IconName } from "@/components/ui/icons";
import { Notice, Section, Stat } from "@/components/ui/primitives";
import { can } from "@/lib/domain";
import { fmtLongDate, fmtTime, fmtWeekday, money, plural } from "@/lib/format";
import { TZ, zonedParts } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { dashboardData } from "@/server/queries";

export const metadata: Metadata = { title: "Painel" };

function Quick({ href, icon, label, kbd }: { href: string; icon: IconName; label: string; kbd?: string }) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-line bg-white p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_24px_-18px_rgba(12,63,128,0.45)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-tint text-ink transition-colors group-hover:bg-ink group-hover:text-white">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <span className="text-[13.5px] font-medium leading-tight text-graphite">{label}</span>
      {kbd ? <kbd className="absolute right-3 top-3 hidden rounded border border-line px-1 font-mono text-[10.5px] text-faint lg:block">{kbd}</kbd> : null}
    </Link>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ negado?: string }> }) {
  const user = await requireUser();
  const { negado } = await searchParams;
  const isAdmin = can(user.role, "settings.manage");
  const [d, template] = await Promise.all([
    dashboardData(),
    isAdmin ? prisma.contractTemplate.findUnique({ where: { id: "default" }, select: { cnpj: true, clauses: true } }) : Promise.resolve(null),
  ]);
  const now = new Date();
  const hour = zonedParts(now, TZ).hour;
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const agenda = buildAgenda(d, now);

  // Resumo do dia em frases curtas
  const count = (kind: string) => agenda.filter((e) => e.kind === kind && !e.late).length;
  const summary = (
    [
      [count("saida"), "saída", "saídas"],
      [count("retorno"), "devolução", "devoluções"],
      [count("montagem"), "montagem", "montagens"],
      [count("desmontagem"), "desmontagem", "desmontagens"],
      [count("evento"), "evento", "eventos"],
    ] as Array<[number, string, string]>
  )
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => plural(n, one, many));
  const late = agenda.filter((e) => e.late).length;

  // Pendências de configuração entram como alertas curtos (só quando faltam de verdade)
  const clauses = Array.isArray(template?.clauses) ? template.clauses.length : 0;
  const setup: AlertItem[] = [];
  if (d.stock.length === 0) {
    setup.push({ count: 0, flag: true, label: "Nenhuma tenda cadastrada", detail: "Cadastre os produtos com foto e preço", href: "/admin/produtos/novo", tone: "warn", icon: "tent" });
  }
  if (isAdmin && (!template?.cnpj || clauses === 0)) {
    setup.push({ count: 0, flag: true, label: "Modelo de contrato incompleto", detail: "Preencha CNPJ e cláusulas da empresa", href: "/admin/configuracoes/contratos", tone: "info", icon: "settings" });
  }
  const alerts = [...operationalAlerts({ ...d, maintenanceUnits: d.totals.maintenance, lowStock: d.lowStock.length }, money, now), ...setup];

  const stockTop = [...d.stock].sort((a, b) => b.qtyRented + b.reserved - (a.qtyRented + a.reserved) || a.name.localeCompare(b.name)).slice(0, 6);
  const parts = { free: d.totals.free, reserved: d.totals.reserved, rented: d.totals.rented, maintenance: d.totals.maintenance };

  return (
    <div className="space-y-6">
      {negado ? <Notice tone="danger">Você não tem permissão para acessar aquela área.</Notice> : null}

      {/* Abertura: o dia em uma frase e as ações principais */}
      <header className="relative animate-rise overflow-hidden rounded-3xl bg-ink-deep text-white">
        <svg className="absolute inset-0 h-full w-full text-white/[0.05]" aria-hidden>
          <defs>
            <pattern id="painel-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0v28" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#painel-grid)" />
        </svg>
        <TentDrawing className="pointer-events-none absolute -bottom-6 right-6 hidden w-[300px] text-white/[0.16] md:block lg:right-12 lg:w-[340px]" strokeWidth={1.2} />
        <div className="relative px-6 py-7 sm:px-8 sm:py-9 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Hoje, {fmtWeekday(now)} · {fmtLongDate(now)}
          </p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.025em] md:text-[38px]">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {summary.length ? (
              summary.map((t) => (
                <span key={t} className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/90">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-white/70">Agenda livre hoje.</span>
            )}
            {late ? <span className="rounded-full bg-accent px-3 py-1 font-semibold text-white">{plural(late, "atrasado", "atrasados")}</span> : null}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/admin/locacoes/nova"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-ink shadow-sm transition-transform hover:-translate-y-px"
            >
              <Icon name="plus" className="h-4 w-4" /> Nova locação
            </Link>
            <Link
              href="/admin/hoje"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/25 px-5 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
            >
              Ver o dia <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section aria-label="Ações rápidas" className="grid animate-rise grid-cols-3 gap-2 [animation-delay:40ms] sm:gap-3 lg:grid-cols-6">
        <Quick href="/admin/vendas/nova" icon="cart" label="Nova venda" />
        <Quick href="/admin/clientes/novo" icon="users" label="Novo cliente" kbd="C" />
        <Quick href="/admin/contratos/novo" icon="clipboard" label="Novo contrato" />
        <Quick href="/admin/estoque/entrada" icon="arrowIn" label="Entrada de estoque" kbd="E" />
        <Quick href="/admin/estoque/saida" icon="arrowOut" label="Saída de estoque" kbd="S" />
        <Quick href="/admin/retorno" icon="undo" label="Conferir retorno" kbd="R" />
      </section>

      {/* Estoque agora: números + distribuição */}
      <section aria-label="Estoque agora" className="animate-rise overflow-hidden rounded-2xl border border-line bg-white [animation-delay:80ms]">
        <div className="grid grid-cols-2 sm:grid-cols-5 [&>*]:border-line max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*]:border-b sm:[&>*:not(:last-child)]:border-r max-sm:[&>*:last-child]:col-span-2 max-sm:[&>*:last-child]:border-r-0">
          <Stat label="Disponível" value={d.totals.free} tone="ok" href="/admin/estoque" hint="livre para uso agora" />
          <Stat label="Reservado" value={d.totals.reserved} tone="info" href="/admin/locacoes?aba=reservas" hint="aguardando saída" />
          <Stat label="Em locação" value={d.totals.rented} tone="accent" href="/admin/locacoes?aba=fora" hint="fora da empresa" />
          <Stat label="Manutenção" value={d.totals.maintenance} tone="neutral" href="/admin/manutencao" hint={plural(d.openMaintenance, "registro aberto", "registros abertos")} />
          <Stat label="Atrasado" value={d.overdueUnits} tone="danger" href="/admin/locacoes?aba=atrasadas" hint={plural(d.overdue.length, "locação", "locações")} />
        </div>
        <div className="border-t border-line px-5 py-4">
          <div className="mb-2 flex items-center justify-between text-xs text-faint">
            <span>
              Distribuição de {plural(d.totals.total, "item", "itens")} em {plural(d.totals.products, "produto", "produtos")}
            </span>
            <Link href="/admin/estoque" className="font-medium text-ink hover:underline">
              Ver estoque
            </Link>
          </div>
          <StockBar parts={parts} />
        </div>
      </section>

      <div className="grid animate-rise items-start gap-6 [animation-delay:120ms] lg:grid-cols-[minmax(0,1fr)_360px]">
        <Section
          title="Agenda de hoje"
          padded={false}
          actions={
            <Link href="/admin/hoje" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
              Abrir o dia <Icon name="arrowRight" className="h-3.5 w-3.5" />
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
          <Link href="/admin/produtos" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:underline">
            Catálogo <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {stockTop.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <TentDrawing className="mb-4 w-28 text-line-strong" strokeWidth={1.4} />
            <p className="text-sm font-medium text-graphite">Nenhuma tenda cadastrada ainda</p>
            <Link href="/admin/produtos/novo" className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft">
              <Icon name="plus" className="h-4 w-4" /> Cadastrar a primeira
            </Link>
          </div>
        ) : (
          <ul className="grid gap-px bg-line/70 sm:grid-cols-2 xl:grid-cols-3">
            {stockTop.map((p) => (
              <li key={p.id} className="bg-white">
                <Link href={`/admin/produtos/${p.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line">
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
