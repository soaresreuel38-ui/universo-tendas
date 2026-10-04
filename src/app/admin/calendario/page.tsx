import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { EmptyState, PageHeader, Section } from "@/components/ui/primitives";
import { CONTRACT_STATUS_LABEL, RENTAL_STATUS_LABEL, effectiveStatus, isOut, type RentalStatus } from "@/lib/domain";
import { fmtTime, seq } from "@/lib/format";
import { DATE_KEY_RE, addDays, addMonths, dayRange, startOfDay, startOfMonthKey, startOfWeekKey, todayKey, weekdayOf } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { peakUsage, toInterval } from "@/server/availability";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Calendário" };

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHOWN: RentalStatus[] = ["RESERVADA", "CONFIRMADA", "SEPARACAO", "SAIU", "EM_EVENTO", "AGUARDANDO_RETORNO", "ATRASADA", "RETORNADA", "CONFERIDA", "FINALIZADA"];

// Mesma linguagem de cores do sistema: azul = reservada, âmbar = em locação, vermelho = atrasada, cinza = encerrada.
const chipTone: Record<string, string> = {
  RESERVADA: "bg-[#eef3fa] text-[#244f8a] border-[#cfdcf0]",
  CONFIRMADA: "bg-[#e3ecf8] text-[#1d4580] border-[#bccfea]",
  SEPARACAO: "bg-[#e3ecf8] text-[#1d4580] border-[#bccfea]",
  SAIU: "bg-[#fbf1e3] text-[#7a4a10] border-[#efd6b0]",
  EM_EVENTO: "bg-[#fbf1e3] text-[#7a4a10] border-[#efd6b0]",
  AGUARDANDO_RETORNO: "bg-[#fbf1e3] text-[#7a4a10] border-[#efd6b0]",
  ATRASADA: "bg-accent-soft text-accent border-[#f0c4c7]",
  RETORNADA: "bg-[#f1eee9] text-[#5f554c] border-line-strong",
  CONFERIDA: "bg-paper text-faint border-line",
  FINALIZADA: "bg-paper text-faint border-line",
};

const LEGEND: Array<[string, string]> = [
  ["bg-st-free", "Disponível"],
  ["bg-st-reserved", "Reservada"],
  ["bg-st-rented", "Em locação"],
  ["bg-st-late", "Atrasada"],
  ["bg-st-maint", "Retornada / manutenção"],
];

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}${y !== Number(todayKey().slice(0, 4)) ? `/${y}` : ""}`;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; data?: string; produto?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const view = sp.view === "dia" || sp.view === "semana" ? sp.view : "mes";
  const ref = sp.data && DATE_KEY_RE.test(sp.data) ? sp.data : todayKey();
  const today = todayKey();

  let first: string;
  let days: number;
  if (view === "dia") {
    first = ref;
    days = 1;
  } else if (view === "semana") {
    first = startOfWeekKey(ref);
    days = 7;
  } else {
    first = startOfWeekKey(startOfMonthKey(ref));
    const last = addDays(addMonths(startOfMonthKey(ref), 1), -1);
    const end = addDays(startOfWeekKey(last), 6);
    days = Math.round((startOfDay(end).getTime() - startOfDay(first).getTime()) / 86_400_000) + 1;
  }
  const keys = Array.from({ length: days }, (_, i) => addDays(first, i));
  const rangeStart = startOfDay(keys[0]);
  const rangeEnd = startOfDay(addDays(keys[keys.length - 1], 1));
  const now = new Date();

  const [rentals, products] = await Promise.all([
    prisma.rental.findMany({
      where: {
        status: { in: SHOWN },
        departureAt: { lt: rangeEnd },
        OR: [{ expectedReturnAt: { gte: rangeStart } }, { actualReturnAt: { gte: rangeStart } }, { status: { in: ["SAIU", "EM_EVENTO", "AGUARDANDO_RETORNO", "ATRASADA", "RETORNADA"] } }],
        ...(sp.produto ? { items: { some: { productId: sp.produto } } } : {}),
      },
      include: {
        customer: { select: { name: true } },
        items: { select: { productId: true, quantity: true } },
        contracts: { where: { status: { not: "CANCELADO" } }, select: { number: true, status: true }, take: 1 },
      },
      orderBy: { departureAt: "asc" },
    }),
    prisma.product.findMany({ where: { active: true, kind: { in: ["RENTAL", "BOTH"] } }, select: { id: true, name: true, qtyAvailable: true, qtyRented: true, unit: true }, orderBy: { name: "asc" } }),
  ]);

  const endOf = (r: (typeof rentals)[number]) => {
    if (r.actualReturnAt) return r.actualReturnAt;
    if (isOut(r.status) && r.expectedReturnAt < now) return now;
    return r.expectedReturnAt;
  };
  const activeOn = (key: string) => {
    const { start, end } = dayRange(key);
    return rentals.filter((r) => r.departureAt < end && endOf(r) >= start);
  };

  // Disponibilidade do produto filtrado em cada dia
  const product = products.find((p) => p.id === sp.produto);
  const freeOn = (key: string) => {
    if (!product) return null;
    const { start, end } = dayRange(key);
    const intervals = rentals
      .filter((r) => !["CONFERIDA", "FINALIZADA"].includes(r.status))
      .flatMap((r) =>
        r.items
          .filter((i) => i.productId === product.id)
          .map((i) => toInterval({ productId: i.productId, quantity: i.quantity, rentalId: r.id, status: r.status, departureAt: r.departureAt, expectedReturnAt: r.expectedReturnAt }, now)),
      );
    const capacity = product.qtyAvailable + product.qtyRented;
    const used = peakUsage(intervals, start.getTime(), end.getTime());
    return { free: Math.max(0, capacity - used), used, capacity };
  };

  const step = view === "dia" ? 1 : view === "semana" ? 7 : 0;
  const prev = step ? addDays(ref, -step) : addMonths(startOfMonthKey(ref), -1);
  const next = step ? addDays(ref, step) : addMonths(startOfMonthKey(ref), 1);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, data: ref, produto: sp.produto, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/calendario?${p}`;
  };
  const [ry, rm] = ref.split("-").map(Number);
  const title =
    view === "mes" ? `${MONTHS[rm - 1]} de ${ry}` : view === "semana" ? `Semana de ${dayLabel(keys[0])} a ${dayLabel(keys[6])}` : dayLabel(ref);

  const Chip = ({ r, day }: { r: (typeof rentals)[number]; day: string }) => {
    const s = effectiveStatus(r, now);
    const { start, end } = dayRange(day);
    const departs = r.departureAt >= start && r.departureAt < end;
    const returns = r.expectedReturnAt >= start && r.expectedReturnAt < end;
    return (
      <Link
        href={`/admin/locacoes/${r.id}`}
        title={`#${seq(r.number)} ${r.eventName} — ${r.customer.name} (${RENTAL_STATUS_LABEL[s]})`}
        className={`block truncate rounded border px-1.5 py-0.5 text-xs ${chipTone[s] ?? "bg-paper"}`}
      >
        {departs ? "↑ " : returns ? "↓ " : ""}
        {r.eventName} — {r.customer.name.split(" ")[0]}
      </Link>
    );
  };

  const agenda = (dayKeys: string[]) => (
    <ul className="divide-y divide-line">
      {dayKeys.map((key) => {
        const list = activeOn(key);
        const f = freeOn(key);
        const { start, end } = dayRange(key);
        const within = (d: Date | null) => d != null && d >= start && d < end;
        return (
          <li key={key} className={`p-4 ${key === today ? "bg-ink-tint/60" : ""}`}>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="font-semibold">
                {WEEKDAYS[(weekdayOf(key) + 6) % 7]}, {dayLabel(key)} {key === today ? <span className="text-xs font-medium text-ink">hoje</span> : null}
              </p>
              {f ? (
                <span className={`text-xs ${f.free > 0 ? "text-st-free" : "text-accent"}`}>
                  {product?.name}: {f.free} livre(s) de {f.capacity}
                </span>
              ) : null}
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-faint">Sem locações.</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((r) => {
                  const s = effectiveStatus(r, now);
                  const departs = r.departureAt >= start && r.departureAt < end;
                  const returns = r.expectedReturnAt >= start && r.expectedReturnAt < end;
                  return (
                    <li key={r.id}>
                      <Link href={`/admin/locacoes/${r.id}`} className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${chipTone[s]}`}>
                        <span className="min-w-0 truncate">
                          <span className="font-mono text-xs opacity-70">#{seq(r.number)}</span> <b>{r.eventName}</b> — {r.customer.name}
                        </span>
                        <span className="shrink-0 text-right text-xs">
                          {[
                            departs ? `Sai ${fmtTime(r.departureAt)}` : null,
                            within(r.setupAt) ? `Montagem ${fmtTime(r.setupAt!)}` : null,
                            within(r.eventAt) ? `Evento ${fmtTime(r.eventAt!)}` : null,
                            within(r.teardownAt) ? `Desmontagem ${fmtTime(r.teardownAt!)}` : null,
                            returns ? `Volta ${fmtTime(r.expectedReturnAt)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || RENTAL_STATUS_LABEL[s]}
                          <span className="block opacity-70">
                            {r.contracts[0] ? `Contrato #${seq(r.contracts[0].number)} · ${CONTRACT_STATUS_LABEL[r.contracts[0].status]}` : "Sem contrato"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      <PageHeader
        hero
        eyebrow="Operação"
        title="Calendário"
        description="↑ saída · ↓ retorno. Nas visões de dia e semana aparecem também montagem, evento, desmontagem e o contrato."
      />
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted" aria-label="Legenda">
        {LEGEND.map(([c, l]) => (
          <li key={l} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${c}`} aria-hidden />
            {l}
          </li>
        ))}
      </ul>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line-strong bg-white p-0.5 text-sm">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <Link key={v} href={qs({ view: v })} className={`rounded-md px-3 py-1.5 font-medium ${view === v ? "bg-graphite text-white" : "text-muted hover:text-graphite"}`}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <Link href={qs({ data: prev })} className="rounded-lg border border-line-strong bg-white p-2 hover:bg-paper" aria-label="Anterior">
            <Icon name="chevronLeft" className="h-4 w-4" />
          </Link>
          <Link href={qs({ data: today })} className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-sm font-medium hover:bg-paper">Hoje</Link>
          <Link href={qs({ data: next })} className="rounded-lg border border-line-strong bg-white p-2 hover:bg-paper" aria-label="Próximo">
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-graphite">{title.replace(/^./, (c) => c.toUpperCase())}</h2>
        <form className="ml-auto flex w-full gap-2 sm:w-auto">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="data" value={ref} />
          <select name="produto" defaultValue={sp.produto ?? ""} className="h-10 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm sm:w-64">
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="h-10 rounded-lg bg-graphite px-4 text-sm font-medium text-white">Ver</button>
        </form>
      </div>
      {product ? (
        <p className="mb-3 text-sm text-muted">
          Mostrando locações e a disponibilidade diária de <b>{product.name}</b> (capacidade atual {product.qtyAvailable + product.qtyRented} {product.unit}).
        </p>
      ) : null}

      {view === "mes" ? (
        <>
          <Section padded={false} className="hidden md:block">
            <div className="eyebrow grid grid-cols-7 border-b border-line text-center">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {keys.map((key) => {
                const inMonth = key.slice(0, 7) === ref.slice(0, 7);
                const list = activeOn(key);
                const f = freeOn(key);
                return (
                  <div key={key} className={`min-h-28 border-b border-r border-line p-1.5 ${inMonth ? "" : "bg-paper/70"} ${key === today ? "bg-ink-tint/60" : ""}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <Link href={qs({ view: "dia", data: key })} className={`text-xs font-medium ${key === today ? "rounded-full bg-ink px-1.5 text-white" : inMonth ? "text-graphite" : "text-faint"}`}>
                        {Number(key.slice(8))}
                      </Link>
                      {f ? <span className={`text-[11px] font-medium ${f.free > 0 ? "text-st-free" : "text-accent"}`}>{f.free} livre</span> : null}
                    </div>
                    {f ? (
                      <div className="mb-1 h-1 overflow-hidden rounded-full bg-line" title={`${f.free} de ${f.capacity} livre(s)`}>
                        <div className={`h-full ${f.free > 0 ? "bg-st-free" : "bg-st-late"}`} style={{ width: `${f.capacity ? (f.free / f.capacity) * 100 : 0}%` }} />
                      </div>
                    ) : null}
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map((r) => (
                        <Chip key={r.id} r={r} day={key} />
                      ))}
                      {list.length > 3 ? (
                        <Link href={qs({ view: "dia", data: key })} className="block text-xs text-faint underline">
                          +{list.length - 3} mais
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section padded={false} className="md:hidden">
            {(() => {
              const monthDays = keys.filter((k) => k.slice(0, 7) === ref.slice(0, 7) && (activeOn(k).length > 0 || k === today));
              return monthDays.length ? agenda(monthDays) : <EmptyState>Nenhuma locação neste mês.</EmptyState>;
            })()}
          </Section>
        </>
      ) : view === "semana" ? (
        <>
          <Section padded={false} className="hidden md:block">
            <div className="grid grid-cols-7 divide-x divide-line">
              {keys.map((key, i) => {
                const f = freeOn(key);
                return (
                  <div key={key} className={`min-h-64 p-2 ${key === today ? "bg-ink-tint/60" : ""}`}>
                    <Link href={qs({ view: "dia", data: key })} className="mb-2 block text-sm font-semibold">
                      {WEEKDAYS[i]} {dayLabel(key)}
                    </Link>
                    {f ? <p className={`mb-1 text-xs ${f.free > 0 ? "text-st-free" : "text-accent"}`}>{f.free} livre(s)</p> : null}
                    <div className="space-y-1">
                      {activeOn(key).map((r) => (
                        <Chip key={r.id} r={r} day={key} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section padded={false} className="md:hidden">
            {agenda(keys)}
          </Section>
        </>
      ) : (
        <Section padded={false}>{agenda(keys)}</Section>
      )}


    </div>
  );
}
