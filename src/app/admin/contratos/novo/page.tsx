import type { Metadata } from "next";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { InlineAction } from "@/components/ui/forms";
import { EmptyState, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createContractAction } from "../actions";

export const metadata: Metadata = { title: "Novo contrato" };

/** Escolher a locação e gerar o contrato com 1 clique (tudo é preenchido a partir dela). */
export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("contract.manage");
  const q = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const rentals = await prisma.rental.findMany({
    where: {
      status: { in: ["ORCAMENTO", "RESERVADA", "CONFIRMADA", "SEPARACAO"] },
      contracts: { none: { status: { not: "CANCELADO" } } },
      ...(q ? { OR: [{ eventName: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { customer: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
    orderBy: { departureAt: "asc" },
    take: 100,
  });
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Novo contrato"
        description="Escolha a locação. Cliente, produtos, valores e datas entram automaticamente. Orçamentos passam a reservar o estoque."
        back={{ href: "/admin/contratos", label: "Contratos" }}
      />
      <form className="mb-3 flex gap-2" role="search">
        <input name="q" defaultValue={q} type="search" placeholder="Cliente ou evento" className="h-11 flex-1 rounded-lg border border-line-strong bg-white px-3" />
        <button className="h-11 rounded-lg bg-graphite px-4 text-sm font-medium text-white hover:bg-black">Buscar</button>
      </form>
      <Section padded={false}>
        {rentals.length === 0 ? (
          <EmptyState action={<LinkButton href="/admin/locacoes/nova" variant="primary" icon="plus">Nova locação</LinkButton>}>
            Nenhuma locação sem contrato. Crie uma locação ou orçamento primeiro.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rentals.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-faint">#{seq(r.number)}</span>
                    <span className="font-medium">{r.customer.name}</span>
                    <RentalStatusBadge rental={r} />
                  </p>
                  <p className="text-sm text-muted">
                    {r.eventName} · saída {fmtDateTime(r.departureAt)} · {money(r.totalCents)}
                  </p>
                  <p className="truncate text-xs text-faint">{r.items.map((i) => `${i.quantity} ${i.product.name}`).join(", ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <InlineAction action={createContractAction} fields={{ rentalId: r.id }} variant="primary" size="md">
                    Gerar contrato
                  </InlineAction>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
