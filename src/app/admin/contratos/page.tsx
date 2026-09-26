import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { Icon } from "@/components/ui/icons";
import { EmptyState, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDate, fmtDateTime, money, seq } from "@/lib/format";
import { dayRange, DATE_KEY_RE } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Contratos" };

const OPEN = ["RASCUNHO", "ENVIADO", "AGUARDANDO_ASSINATURA"] as const;

function tabs(now: Date): Array<{ key: string; label: string; where: Prisma.ContractWhereInput }> {
  const expired: Prisma.ContractWhereInput = { status: { in: [...OPEN] }, rental: { departedAt: null, departureAt: { lt: now } } };
  return [
    { key: "recentes", label: "Recentes", where: {} },
    { key: "assinatura", label: "Aguardando assinatura", where: { status: { in: [...OPEN] }, NOT: expired } },
    { key: "ativos", label: "Ativos", where: { status: { in: ["ASSINADO", "ATIVO"] } } },
    { key: "finalizados", label: "Finalizados", where: { status: "FINALIZADO" } },
    { key: "cancelados", label: "Cancelados", where: { status: "CANCELADO" } },
    { key: "vencidos", label: "Vencidos", where: expired },
  ];
}

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; data?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const TABS = tabs(now);
  // Links antigos: "abertos"/"assinados"/"todos"
  const alias: Record<string, string> = { abertos: "assinatura", assinados: "ativos", todos: "recentes" };
  const tab = TABS.find((t) => t.key === (alias[sp.aba ?? ""] ?? sp.aba)) ?? TABS[0];
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const digits = q.replace(/\D/g, "");
  const num = /^#?\d{1,9}$/.test(q) ? Number(digits) : null;
  const day = sp.data && DATE_KEY_RE.test(sp.data) ? dayRange(sp.data) : null;

  const search: Prisma.ContractWhereInput = {
    ...(q
      ? {
          OR: [
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { document: { contains: q } } },
            ...(digits.length >= 4 ? [{ customer: { document: { contains: digits } } }] : []),
            { rental: { eventName: { contains: q, mode: "insensitive" } } },
            ...(num ? [{ number: num }] : []),
          ],
        }
      : {}),
    ...(day
      ? { OR: [{ createdAt: { gte: day.start, lt: day.end } }, { rental: { departureAt: { gte: day.start, lt: day.end } } }, { rental: { eventAt: { gte: day.start, lt: day.end } } }] }
      : {}),
  };
  const [contracts, counts, pendingRentals] = await Promise.all([
    prisma.contract.findMany({
      where: { AND: [tab.where, search] },
      include: {
        customer: { select: { name: true, document: true } },
        rental: { select: { number: true, eventName: true, departureAt: true, departedAt: true, totalCents: true } },
        _count: { select: { signatures: true } },
      },
      orderBy: { number: "desc" },
      take: 300,
    }),
    Promise.all(TABS.map((t) => prisma.contract.count({ where: t.where }))),
    prisma.rental.count({ where: { status: { in: ["RESERVADA", "CONFIRMADA", "SEPARACAO"] }, contracts: { none: { status: { not: "CANCELADO" } } } } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Contratos"
        description="Documentos gerados automaticamente a partir das locações, sem redigitar dados."
        actions={
          <>
            <LinkButton href="/admin/configuracoes/contratos" icon="settings">
              Modelo
            </LinkButton>
            <LinkButton href="/admin/contratos/novo" variant="primary" icon="plus">
              Novo contrato
            </LinkButton>
          </>
        }
      />

      {pendingRentals ? (
        <Link
          href="/admin/contratos/novo"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3.5 text-sm text-amber-950 transition-colors hover:bg-amber-50"
        >
          <Icon name="file" className="h-5 w-5 shrink-0 text-amber-700" />
          <span className="flex-1">
            <b>{pendingRentals}</b> {pendingRentals === 1 ? "reserva ainda não tem" : "reservas ainda não têm"} contrato.
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            Gerar agora <Icon name="arrowRight" className="h-4 w-4" />
          </span>
        </Link>
      ) : null}

      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Situação">
        {TABS.map((t, i) => {
          const on = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/admin/contratos?aba=${t.key}`}
              aria-current={on ? "page" : undefined}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13.5px] font-medium transition-colors ${
                on ? "border-ink text-graphite" : "border-transparent text-faint hover:text-graphite"
              }`}
            >
              {t.label}
              <span className={`tabular rounded-full px-1.5 text-[11px] ${on ? "bg-ink-tint text-ink" : t.key === "vencidos" && counts[i] ? "bg-accent-soft text-accent" : "bg-canvas text-faint"}`}>
                {counts[i]}
              </span>
            </Link>
          );
        })}
      </nav>

      <form className="mb-5 flex flex-col gap-2 sm:flex-row" role="search">
        <input type="hidden" name="aba" value={tab.key} />
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            name="q"
            defaultValue={q}
            type="search"
            placeholder="Número, cliente, CPF/CNPJ ou evento"
            aria-label="Buscar contratos"
            className="h-10 w-full rounded-lg border border-line-strong bg-white pl-9 pr-3 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-ink/10"
          />
        </div>
        <input
          name="data"
          type="date"
          defaultValue={sp.data ?? ""}
          aria-label="Data (emissão, saída ou evento)"
          className="h-10 rounded-lg border border-line-strong bg-white px-3 text-sm outline-none focus:border-ink"
        />
        <button className="h-10 rounded-lg bg-graphite px-5 text-sm font-medium text-white hover:bg-black">Buscar</button>
      </form>

      <Section padded={false}>
        {contracts.length === 0 ? (
          <EmptyState icon="file">{q || day ? "Nenhum contrato encontrado." : "Nenhum contrato nesta lista."}</EmptyState>
        ) : (
          <ul className="divide-y divide-line/70">
            {contracts.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/contratos/${c.id}`} className="group grid grid-cols-[40px_1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-paper md:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_120px_130px_150px]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-paper text-ink">
                    <Icon name="file" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-graphite group-hover:text-ink">
                      <span className="font-mono text-[12.5px] font-medium text-faint">Nº {seq(c.number)}</span> · {c.customer.name}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {c.customer.document ?? "Sem CPF/CNPJ"} · emitido {fmtDate(c.createdAt)}
                    </span>
                  </span>
                  <span className="col-start-2 min-w-0 truncate text-[13px] text-muted md:col-start-auto">
                    {c.rental ? (
                      <>
                        {c.rental.eventName} <span className="font-mono text-[11.5px] text-faint">#{seq(c.rental.number)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="hidden text-[13px] text-muted md:block">{c.rental ? fmtDateTime(c.rental.departureAt) : "—"}</span>
                  <span className="tabular hidden text-right text-sm font-medium text-graphite md:block">{money(c.rental?.totalCents)}</span>
                  <span className="col-start-3 row-span-2 row-start-1 flex flex-col items-end gap-1 md:col-start-auto md:row-span-1 md:row-start-auto">
                    <ContractStatusBadge contract={c} />
                    <span className="text-[11px] text-faint">{c._count.signatures}/2 assinaturas</span>
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
