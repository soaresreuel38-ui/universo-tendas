import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { EmptyState, PageHeader, Section } from "@/components/ui/primitives";
import { RENTAL_STATUS_LABEL, effectiveStatus, isOut, type RentalStatus } from "@/lib/domain";
import { fmtTime, seq } from "@/lib/format";
import { DATE_KEY_RE, addDays, addMonths, dayRange, startOfDay, startOfMonthKey, startOfWeekKey, todayKey, weekdayOf } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { peakUsage, toInterval } from "@/server/availability";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Calendário" };

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHOWN: RentalStatus[] = ["RESERVADA", "CONFIRMADA", "SEPARACAO", "SAIU", "EM_EVENTO", "AGUARDANDO_RETORNO", "ATRASADA", "RETORNADA", "CONFERIDA", "FINALIZADA"];

const chipTone: Record<string, string> = {
  RESERVADA: "bg-sky-50 text-sky-900 border-sky-200",
  CONFIRMADA: "bg-sky-100 text-sky-900 border-sky-300",
  SEPARACAO: "bg-amber-50 text-amber-900 border-amber-200",
  SAIU: "bg-amber-100 text-amber-900 border-amber-300",
  EM_EVENTO: "bg-amber-100 text-amber-900 border-amber-300",
  AGUARDANDO_RETORNO: "bg-yellow-50 text-yellow-900 border-yellow-300",
  ATRASADA: "bg-red-50 text-red-800 border-red-300",
  RETORNADA: "bg-yellow-50 text-yellow-900 border-yellow-300",
  CONFERIDA: "bg-zinc-50 text-zinc-500 border-zinc-200",
  FINALIZADA: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

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
      include: { customer: { select: { name: true } }, items: { select: { productId: true, quantity: true } } },
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
        className={`block truncate rounded border px-1.5 py-0.5 text-xs ${chipTone[s] ?? "bg-zinc-50"}`}
      >
        {departs ? "↑ " : returns ? "↓ " : ""}
        {r.eventName} — {r.customer.name.split(" ")[0]}
      </Link>
    );
  };

  const agenda = (dayKeys: string[]) => (
    <ul className="divide-y divide-zinc-100">
      {dayKeys.map((key) => {
        const list = activeOn(key);
        const f = freeOn(key);
        const { start, end } = dayRange(key);
        return (
          <li key={key} className={`p-4 ${key === today ? "bg-amber-50/40" : ""}`}>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="font-semibold">
                {WEEKDAYS[(weekdayOf(key) + 6) % 7]}, {dayLabel(key)} {key === today ? <span className="text-xs font-normal text-accent">hoje</span> : null}
              </p>
              {f ? (
                <span className={`text-xs ${f.free > 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {product?.name}: {f.free} livre(s) de {f.capacity}
                </span>
              ) : null}
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-zinc-400">Sem locações.</p>
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
                        <span className="shrink-0 text-xs">
                          {departs ? `Sai ${fmtTime(r.departureAt)}` : returns ? `Volta ${fmtTime(r.expectedReturnAt)}` : RENTAL_STATUS_LABEL[s]}
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
      <PageHeader title="Calendário de locações" description="↑ saída do estoque · ↓ retorno previsto. Toque em uma locação para ver os detalhes." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 bg-white text-sm">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <Link key={v} href={qs({ view: v })} className={`px-3 py-2 ${view === v ? "bg-ink text-white" : "hover:bg-zinc-50"}`}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <Link href={qs({ data: prev })} className="rounded-md border border-zinc-300 bg-white p-2" aria-label="Anterior">
            <Icon name="chevronLeft" className="h-4 w-4" />
          </Link>
          <Link href={qs({ data: today })} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm">Hoje</Link>
          <Link href={qs({ data: next })} className="rounded-md border border-zinc-300 bg-white p-2" aria-label="Próximo">
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        <h2 className="text-lg font-semibold">{title.replace(/^./, (c) => c.toUpperCase())}</h2>
        <form className="ml-auto flex w-full gap-2 sm:w-auto">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="data" value={ref} />
          <select name="produto" defaultValue={sp.produto ?? ""} className="h-10 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm sm:w-64">
            <option value="">Todos os produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="h-10 rounded-md bg-ink px-3 text-sm text-white">Ver</button>
        </form>
      </div>
      {product ? (
        <p className="mb-3 text-sm text-zinc-600">
          Mostrando locações e a disponibilidade diária de <b>{product.name}</b> (capacidade atual {product.qtyAvailable + product.qtyRented} {product.unit}).
        </p>
      ) : null}

      {view === "mes" ? (
        <>
          <Section padded={false} className="hidden md:block">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium uppercase text-zinc-500">
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
                  <div key={key} className={`min-h-28 border-b border-r border-zinc-100 p-1.5 ${inMonth ? "" : "bg-zinc-50/70"} ${key === today ? "bg-amber-50/50" : ""}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <Link href={qs({ view: "dia", data: key })} className={`text-xs font-medium ${key === today ? "rounded bg-accent px-1.5 text-white" : inMonth ? "text-zinc-800" : "text-zinc-400"}`}>
                        {Number(key.slice(8))}
                      </Link>
                      {f ? <span className={`text-[11px] font-medium ${f.free > 0 ? "text-emerald-700" : "text-red-700"}`}>{f.free} livre</span> : null}
                    </div>
                    <div className="space-y-0.5">
                      {list.slice(0, 3).map((r) => (
                        <Chip key={r.id} r={r} day={key} />
                      ))}
                      {list.length > 3 ? (
                        <Link href={qs({ view: "dia", data: key })} className="block text-xs text-zinc-500 underline">
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
            <div className="grid grid-cols-7 divide-x divide-zinc-100">
              {keys.map((key, i) => {
                const f = freeOn(key);
                return (
                  <div key={key} className={`min-h-64 p-2 ${key === today ? "bg-amber-50/50" : ""}`}>
                    <Link href={qs({ view: "dia", data: key })} className="mb-2 block text-sm font-semibold">
                      {WEEKDAYS[i]} {dayLabel(key)}
                    </Link>
                    {f ? <p className={`mb-1 text-xs ${f.free > 0 ? "text-emerald-700" : "text-red-700"}`}>{f.free} livre(s)</p> : null}
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

      <p className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-sky-300 bg-sky-100" />Reservada/confirmada</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-100" />Fora (saiu/em evento)</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-red-300 bg-red-50" />Atrasada</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-zinc-200 bg-zinc-50" />Encerrada</span>
      </p>
    </div>
  );
}
