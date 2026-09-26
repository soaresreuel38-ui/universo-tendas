import type { Metadata } from "next";
import Link from "next/link";
import { ContractStatusBadge } from "@/components/contracts/ContractStatusBadge";
import { Badge, EmptyState, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Documentos" };

type Row = { key: string; date: Date; kind: string; title: string; customer: string; href: string; detail?: string; badge?: React.ReactNode; open?: string };

const KINDS = [
  { key: "", label: "Todos" },
  { key: "contratos", label: "Contratos" },
  { key: "orcamentos", label: "Orçamentos" },
  { key: "vendas", label: "Comprovantes de venda" },
  { key: "assinados", label: "Assinados / anexos" },
];

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const tipo = sp.tipo ?? "";
  const byCustomer = q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { document: { contains: q } }, { phone: { contains: q } }] } : undefined;
  const want = (k: string) => !tipo || tipo === k;

  const [contracts, quotes, sales, docs] = await Promise.all([
    want("contratos") ? prisma.contract.findMany({ where: byCustomer ? { customer: byCustomer } : {}, include: { customer: true, rental: true }, orderBy: { createdAt: "desc" }, take: 150 }) : [],
    want("orcamentos") ? prisma.rental.findMany({ where: { status: "ORCAMENTO", ...(byCustomer ? { customer: byCustomer } : {}) }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 150 }) : [],
    want("vendas") ? prisma.sale.findMany({ where: byCustomer ? { customer: byCustomer } : q ? { customerName: { contains: q, mode: "insensitive" } } : {}, include: { customer: true }, orderBy: { soldAt: "desc" }, take: 150 }) : [],
    want("assinados") ? prisma.document.findMany({ where: byCustomer ? { customer: byCustomer } : {}, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 150, omit: { data: true } }) : [],
  ]);

  const rows: Row[] = [
    ...contracts.map((c) => ({
      key: `c${c.id}`,
      date: c.createdAt,
      kind: "Contrato",
      title: `Contrato #${seq(c.number)}${c.rental ? ` — ${c.rental.eventName}` : ""}`,
      customer: c.customer.name,
      href: `/admin/contratos/${c.id}`,
      open: `/api/pdf/contrato/${c.id}`,
      badge: <ContractStatusBadge contract={c} />,
    })),
    ...quotes.map((r) => ({
      key: `q${r.id}`,
      date: r.createdAt,
      kind: "Orçamento",
      title: `Orçamento #${seq(r.number)} — ${r.eventName}`,
      customer: r.customer.name,
      href: `/admin/locacoes/${r.id}`,
      open: `/api/pdf/orcamento/${r.id}`,
      detail: money(r.totalCents),
    })),
    ...sales.map((s) => ({
      key: `s${s.id}`,
      date: s.soldAt,
      kind: "Comprovante",
      title: `Venda #${seq(s.number)}`,
      customer: s.customer?.name ?? s.customerName ?? "Venda avulsa",
      href: `/admin/vendas/${s.id}`,
      open: `/api/pdf/venda/${s.id}`,
      detail: s.status === "CANCELADA" ? "Cancelada" : money(s.totalCents),
    })),
    ...docs.map((d) => ({
      key: `d${d.id}`,
      date: d.createdAt,
      kind: d.kind === "CONTRATO_ASSINADO" ? "Contrato assinado" : "Anexo",
      title: d.title,
      customer: d.customer?.name ?? "—",
      href: `/api/documentos/${d.id}`,
      open: `/api/documentos/${d.id}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div>
      <PageHeader title="Documentos" description="Contratos, orçamentos, comprovantes e documentos assinados — tudo em PDF." />
      <form className="mb-3 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto]" role="search">
        <input name="q" defaultValue={q} type="search" placeholder="Buscar por cliente, CPF/CNPJ ou telefone" className="col-span-2 h-10 rounded-lg border border-line-strong bg-white px-3 text-sm sm:col-span-1" />
        <select name="tipo" defaultValue={tipo} className="h-10 rounded-lg border border-line-strong bg-white px-2 text-sm">
          {KINDS.map((k) => (
            <option key={k.key} value={k.key}>{k.label}</option>
          ))}
        </select>
        <button className="h-10 rounded-lg bg-graphite px-4 text-sm font-medium text-white hover:bg-black">Filtrar</button>
      </form>
      <Section padded={false}>
        {rows.length === 0 ? (
          <EmptyState>Nenhum documento encontrado.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-4 py-3">
                <Link href={r.href} className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge>{r.kind}</Badge>
                    <span className="font-medium text-graphite">{r.title}</span>
                    {r.badge}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-faint">
                    {r.customer} · {fmtDateTime(r.date)}
                    {r.detail ? ` · ${r.detail}` : ""}
                  </p>
                </Link>
                {r.open ? (
                  <a href={r.open} target="_blank" rel="noopener" className="shrink-0 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium hover:bg-paper">
                    PDF
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
