import type { Db } from "./errors";

export type AuditEntity = "Rental" | "Contract" | "Sale" | "Product" | "Customer" | "User" | "Settings" | "Maintenance";

/** Registra no histórico quem fez o quê e quando. O histórico nunca é apagado. */
export async function audit(
  tx: Db,
  entry: { userId: string | null; action: string; entityType: AuditEntity; entityId: string; summary: string },
) {
  await tx.auditLog.create({ data: { ...entry, summary: entry.summary.slice(0, 500) } });
}
