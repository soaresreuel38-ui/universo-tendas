import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { isOut } from "@/lib/domain";
import { fmtDateTime, seq } from "@/lib/format";
import { toLocalInput } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { checkInAction } from "../../actions";
import { CheckInForm } from "./CheckInForm";

export const metadata: Metadata = { title: "Conferência de retorno" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("rental.checkin");
  const { id } = await params;
  const r = await prisma.rental.findUnique({
    where: { id },
    include: { customer: true, items: { include: { product: true, units: { include: { unit: true } } }, orderBy: { product: { name: "asc" } } } },
  });
  if (!r) notFound();
  if (!isOut(r.status)) redirect(`/admin/locacoes/${id}`);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Conferência — Locação #${seq(r.number)}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {r.customer.name} · {r.eventName} · retorno previsto {fmtDateTime(r.expectedReturnAt)} <RentalStatusBadge rental={r} />
          </span>
        }
        back={{ href: `/admin/locacoes/${r.id}`, label: `#${seq(r.number)}` }}
      />
      <p className="mb-4 text-sm text-zinc-600">Responsável pela conferência: <b>{user.name}</b></p>
      <CheckInForm
        rentalId={r.id}
        action={checkInAction}
        now={toLocalInput(new Date())}
        items={r.items.map((i) => ({
          id: i.id,
          name: i.product.name,
          unit: i.product.unit,
          quantity: i.quantity,
          units: i.units
            .map((u) => ({ unitId: u.unitId, code: u.unit.code }))
            .sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true })),
        }))}
      />
    </div>
  );
}
