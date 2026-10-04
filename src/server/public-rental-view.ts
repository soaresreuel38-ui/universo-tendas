import type { BusinessSettings } from "@prisma/client";
import { canRequestCancel, publicStatus } from "@/lib/booking";
import { CONTRACT_STATUS_LABEL, type ContractStatus, type RentalStatus } from "@/lib/domain";
import { seq } from "@/lib/format";
import type { PublicRental } from "./public-booking";

/** Dados da reserva que o próprio cliente pode ver (nada de anotações internas). */
export function serializeRental(r: PublicRental, settings: Pick<BusinessSettings, "whatsappNumber" | "phones"> | null) {
  const status = r.status as RentalStatus;
  const contract = r.contracts[0];
  const paid = r.payments.reduce((s, p) => s + p.amountCents, 0);
  return {
    code: seq(r.number),
    status: publicStatus({ status, cancelRequestedAt: r.cancelRequestedAt }),
    canRequestCancel: canRequestCancel(status) && !r.cancelRequestedAt,
    customerName: r.customer.personType === "PJ" ? (r.customer.tradeName ?? r.customer.name) : r.customer.name,
    eventName: r.eventName,
    eventAt: (r.eventAt ?? r.departureAt).toISOString(),
    eventEndAt: (r.eventEndAt ?? r.eventAt ?? r.departureAt).toISOString(),
    address: r.eventAddress,
    eventNotes: r.eventNotes,
    items: r.items.map((i) => ({
      name: i.product.name,
      code: i.product.sku,
      unit: i.product.unit,
      quantity: i.quantity,
      unitPriceCents: r.pricePending && i.unitPriceCents === 0 ? null : i.unitPriceCents,
      photoId: i.product.photoId,
      path: `/tendas/${i.product.slug ?? i.product.id}`,
    })),
    pricePending: r.pricePending,
    days: r.billingMode === "DIARIA" ? r.periodCount : null,
    totalCents: r.totalCents,
    paidCents: paid,
    contract: contract
      ? { number: seq(contract.number), status: CONTRACT_STATUS_LABEL[contract.status as ContractStatus], signed: Boolean(contract.signedAt) }
      : null,
    companyWhatsapp: settings?.whatsappNumber ?? null,
    companyPhones: settings?.phones ?? null,
  };
}

export type RentalView = ReturnType<typeof serializeRental>;
