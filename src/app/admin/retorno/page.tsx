import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { EmptyState, PageHeader, Section, buttonClass } from "@/components/ui/primitives";
import { OUT_STATUSES, isOverdue } from "@/lib/domain";
import { fmtDateTime, seq } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { rentalListInclude } from "@/server/queries";

export const metadata: Metadata = { title: "Retornos" };

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("rental.checkin");
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim().slice(0, 80) ?? "";
  const num = Number(q.replace(/\D/g, ""));
  const where: Prisma.RentalWhereInput = {
    status: { in: [...OUT_STATUSES] },
    ...(q
      ? {
          OR: [
            { eventName: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q } } },
            ...(num ? [{ number: num }] : []),
          ],
        }
      : {}),
  };
  const rentals = await prisma.rental.findMany({ where, include: rentalListInclude, orderBy: { expectedReturnAt: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Registrar retorno" description="O que deveria voltar. Escolha a locação para conferir os produtos." />
      <form className="mb-3 flex gap-2" role="search">
        <input name="q" defaultValue={q} type="search" placeholder="Nº da locação, cliente, evento ou telefone" className="h-11 flex-1 rounded-lg border border-line-strong bg-white px-3" />
        <button className="h-11 rounded-lg bg-graphite px-4 text-sm font-medium text-white hover:bg-black">Buscar</button>
      </form>
      <Section padded={false}>
        {rentals.length === 0 ? (
          <EmptyState>{q ? "Nenhuma locação fora encontrada." : "Nenhuma locação fora da empresa no momento."}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rentals.map((r) => (
              <li key={r.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${isOverdue(r) ? "bg-red-50/40" : ""}`}>
                <Link href={`/admin/locacoes/${r.id}`} className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-faint">#{seq(r.number)}</span>
                    <span className="font-medium">{r.eventName}</span>
                    <RentalStatusBadge rental={r} />
                  </p>
                  <p className="text-sm text-muted">
                    {r.customer.name} · retorno previsto {fmtDateTime(r.expectedReturnAt)}
                  </p>
                  <p className="truncate text-xs text-faint">{r.items.map((i) => `${i.quantity} ${i.product.name}`).join(", ")}</p>
                </Link>
                <Link href={`/admin/locacoes/${r.id}/conferencia`} className={`${buttonClass("accent", "lg")} w-full sm:w-auto`}>
                  Conferir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
