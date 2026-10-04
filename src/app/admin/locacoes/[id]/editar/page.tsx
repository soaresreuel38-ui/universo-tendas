import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { EDITABLE_STATUSES } from "@/lib/domain";
import { moneyInput, seq } from "@/lib/format";
import { toLocalInput } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { rentalFormOptions } from "@/server/rental-form-data";
import { updateRentalAction } from "../../actions";
import { RentalForm } from "../../RentalForm";

export const metadata: Metadata = { title: "Editar locação" };

export default async function EditRentalPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("rental.manage");
  const { id } = await params;
  const r = await prisma.rental.findUnique({ where: { id }, include: { items: true, customer: true } });
  if (!r) notFound();
  if (!EDITABLE_STATUSES.includes(r.status)) redirect(`/admin/locacoes/${id}`);
  const { customers, products } = await rentalFormOptions();
  // Mantém visíveis cliente/produtos desativados já usados nesta locação.
  if (!customers.some((c) => c.value === r.customerId)) customers.unshift({ value: r.customerId, label: r.customer.name, sub: undefined });
  const missing = r.items.filter((i) => !products.some((p) => p.value === i.productId));
  if (missing.length) {
    const extra = await prisma.product.findMany({ where: { id: { in: missing.map((m) => m.productId) } } });
    products.push(...extra.map((p) => ({ value: p.id, label: `${p.name} (inativo)`, sub: p.sku, unit: p.unit, rentalPriceCents: p.rentalPriceCents })));
  }
  return (
    <div className="max-w-4xl">
      <PageHeader title={`Editar locação #${seq(r.number)}`} back={{ href: `/admin/locacoes/${id}`, label: `#${seq(r.number)}` }} />
      <RentalForm
        action={updateRentalAction}
        customers={customers}
        products={products}
        initial={{
          id: r.id,
          status: r.status,
          customerId: r.customerId,
          eventName: r.eventName,
          eventAddress: r.eventAddress ?? "",
          setupAt: toLocalInput(r.setupAt),
          departureAt: toLocalInput(r.departureAt),
          eventAt: toLocalInput(r.eventAt),
          expectedReturnAt: toLocalInput(r.expectedReturnAt),
          pickupBy: r.pickupBy ?? "",
          notes: r.notes ?? "",
          discount: r.discountCents ? moneyInput(r.discountCents) : "",
          billingMode: r.billingMode,
          periodCount: r.periodCount,
          items: r.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: moneyInput(i.unitPriceCents) })),
        }}
      />
    </div>
  );
}
