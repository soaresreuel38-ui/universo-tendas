import type { PaymentMethod, PrismaClient } from "@prisma/client";
import { money, seq } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { audit } from "./audit";
import { assertCan, DomainError, type Actor, type Db } from "./errors";
import { withTx } from "./stock";

export type PaymentInput = { amountCents: number; method: PaymentMethod; paidAt?: Date; notes?: string | null };

function validate(p: PaymentInput) {
  if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) throw new DomainError("Informe um valor de pagamento maior que zero.");
  if (!(p.method in PAYMENT_METHOD_LABEL)) throw new DomainError("Forma de pagamento inválida.");
}

export async function addPaymentInTx(tx: Db, actor: Actor, target: { rentalId?: string; saleId?: string }, p: PaymentInput) {
  validate(p);
  const payment = await tx.payment.create({
    data: { ...target, amountCents: p.amountCents, method: p.method, paidAt: p.paidAt ?? new Date(), notes: p.notes?.trim() || null, userId: actor.id },
  });
  const ref = target.rentalId
    ? `locação #${seq((await tx.rental.findUniqueOrThrow({ where: { id: target.rentalId } })).number)}`
    : `venda #${seq((await tx.sale.findUniqueOrThrow({ where: { id: target.saleId! } })).number)}`;
  await audit(tx, {
    userId: actor.id,
    action: "payment.add",
    entityType: target.rentalId ? "Rental" : "Sale",
    entityId: (target.rentalId ?? target.saleId)!,
    summary: `Registrou pagamento de ${money(p.amountCents)} (${PAYMENT_METHOD_LABEL[p.method]}) na ${ref}`,
  });
  return payment;
}

export async function registerRentalPayment(db: PrismaClient, actor: Actor, rentalId: string, p: PaymentInput) {
  assertCan(actor, "payment.register");
  return withTx(db, async (tx) => {
    const rental = await tx.rental.findUnique({ where: { id: rentalId } });
    if (!rental) throw new DomainError("Locação não encontrada.");
    if (rental.status === "CANCELADA") throw new DomainError("Locação cancelada.");
    return addPaymentInTx(tx, actor, { rentalId }, p);
  });
}
