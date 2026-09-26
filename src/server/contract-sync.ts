import type { Db } from "./errors";

// ───────────────────────── Sincronização com a locação ─────────────────────────

/** Chamado pelas operações de locação (mesma transação) para manter o status do contrato coerente. */
export async function syncContractsWithRental(tx: Db, rentalId: string, event: "departed" | "checked_in" | "finalized" | "canceled") {
  if (event === "departed") {
    await tx.contract.updateMany({ where: { rentalId, status: "ASSINADO" }, data: { status: "ATIVO" } });
  } else if (event === "checked_in" || event === "finalized") {
    await tx.contract.updateMany({ where: { rentalId, status: { in: ["ASSINADO", "ATIVO"] } }, data: { status: "FINALIZADO" } });
  } else {
    await tx.contract.updateMany({
      where: { rentalId, status: { in: ["RASCUNHO", "ENVIADO", "AGUARDANDO_ASSINATURA", "ASSINADO"] } },
      data: { status: "CANCELADO", canceledAt: new Date(), cancelReason: "Locação cancelada", signTokenHash: null, signTokenExpiresAt: null },
    });
  }
}
