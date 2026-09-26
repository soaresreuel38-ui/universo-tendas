import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Notice, PageHeader } from "@/components/ui/primitives";
import { RENTAL_TRANSITIONS } from "@/lib/domain";
import { fmtDateTime, seq } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { availabilityForPeriod } from "@/server/availability";
import { prisma } from "@/server/db";
import { departAction } from "../../actions";
import { DepartureForm } from "./DepartureForm";

export const metadata: Metadata = { title: "Registrar saída" };

export default async function DeparturePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("rental.manage");
  const { id } = await params;
  const r = await prisma.rental.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { include: { units: { where: { status: "AVAILABLE" }, orderBy: { code: "asc" } } } } } },
    },
  });
  if (!r) notFound();
  if (!RENTAL_TRANSITIONS[r.status].includes("SAIU")) redirect(`/admin/locacoes/${id}`);

  const now = new Date();
  const from = r.departureAt > now ? now : r.departureAt;
  const avail = r.expectedReturnAt > now ? await availabilityForPeriod(prisma, r.items.map((i) => i.productId), from, r.expectedReturnAt, { excludeRentalId: r.id }) : new Map();
  const problems = r.items.filter((i) => i.product.qtyAvailable < i.quantity || (avail.get(i.productId)?.free ?? 0) < i.quantity);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`SAÍDA #${seq(r.number)}`}
        description={`Locação #${seq(r.number)} — ${r.eventName} · ${r.customer.name}`}
        back={{ href: `/admin/locacoes/${r.id}`, label: `#${seq(r.number)}` }}
      />
      {r.expectedReturnAt <= now ? (
        <Notice tone="danger">O retorno previsto ({fmtDateTime(r.expectedReturnAt)}) já passou. Edite as datas da locação antes de registrar a saída.</Notice>
      ) : null}
      {problems.length ? (
        <div className="mb-4">
          <Notice tone="danger">
            Estoque insuficiente para: {problems.map((p) => p.product.name).join(", ")}. A saída será bloqueada até haver estoque.
          </Notice>
        </div>
      ) : null}
      <DepartureForm
        rentalId={r.id}
        action={departAction}
        pickupBy={r.pickupBy ?? ""}
        blocked={problems.length > 0 || r.expectedReturnAt <= now}
        items={r.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          name: i.product.name,
          unit: i.product.unit,
          photoId: i.product.photoId,
          quantity: i.quantity,
          inStock: i.product.qtyAvailable,
          free: avail.get(i.productId)?.free ?? 0,
          byUnit: i.product.trackingMode === "UNIT",
          units: i.product.units.map((u) => ({ id: u.id, code: u.code })),
        }))}
      />
      <p className="mt-3 text-sm text-muted">
        Retorno previsto: <b>{fmtDateTime(r.expectedReturnAt)}</b>
      </p>
    </div>
  );
}
