"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { zDateTime, zId, zInt, zMoney, zOptText, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { adjustInventory, closeMaintenance, resolvePending, stockEntry, stockExit } from "@/server/stock";

export async function stockEntryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({
        productId: zId,
        quantity: zInt("Quantidade", 1, 100_000),
        reason: z.enum(["COMPRA", "DEVOLUCAO", "AJUSTE", "OUTRO"], { message: "Selecione o motivo." }),
        occurredAt: zDateTime("Data"),
        notes: zOptText(1000),
      })
      .parse({
        productId: str(form, "productId"),
        quantity: str(form, "quantity"),
        reason: str(form, "reason"),
        occurredAt: str(form, "occurredAt"),
        notes: str(form, "notes"),
      });
    const p = await stockEntry(prisma, user, data);
    refreshPanel();
    return `Entrada registrada: +${data.quantity} ${p.name}. Disponível no depósito: ${p.qtyAvailable}.`;
  });
}

export async function stockExitAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({
        productId: zId,
        quantity: zInt("Quantidade", 1, 100_000),
        kind: z.enum(["MANUTENCAO", "PERDA", "TRANSFERENCIA", "OUTRO"], { message: "Tipo de saída inválido." }),
        reason: zReqText(300, "Motivo"),
        notes: zOptText(1000),
        occurredAt: zDateTime("Data"),
        unitIds: z.array(zId).max(10_000),
      })
      .parse({
        productId: str(form, "productId"),
        quantity: str(form, "quantity"),
        kind: str(form, "kind"),
        reason: str(form, "reason"),
        notes: str(form, "notes"),
        occurredAt: str(form, "occurredAt"),
        unitIds: form.getAll("unitIds").map(String),
      });
    const p = await stockExit(prisma, user, data);
    refreshPanel();
    return `Saída registrada: −${data.quantity} ${p.name}. Disponível no depósito: ${p.qtyAvailable}.`;
  });
}

export async function adjustInventoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({ productId: zId, countedQty: zInt("Quantidade contada", 0, 1_000_000), reason: zReqText(200, "Motivo") })
      .parse({ productId: str(form, "productId"), countedQty: str(form, "countedQty"), reason: str(form, "reason") });
    await adjustInventory(prisma, user, data);
    refreshPanel();
    return "Ajuste aplicado e registrado no histórico.";
  });
}

export async function closeMaintenanceAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({
        maintenanceId: zId,
        outcome: z.enum(["CONCLUIDA", "DESCARTADA"]),
        notes: zOptText(1000),
        costCents: zMoney("Custo"),
      })
      .parse({ maintenanceId: str(form, "maintenanceId"), outcome: str(form, "outcome"), notes: str(form, "notes"), costCents: str(form, "cost") });
    await closeMaintenance(prisma, user, data);
    refreshPanel();
    return data.outcome === "CONCLUIDA" ? "Manutenção concluída: item voltou ao estoque disponível." : "Item baixado do estoque (descartado).";
  });
}

export async function resolvePendingAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({ rentalItemId: zId, quantity: zInt("Quantidade", 1), outcome: z.enum(["ENCONTRADO", "PERDIDO"]), notes: zOptText(1000) })
      .parse({ rentalItemId: str(form, "rentalItemId"), quantity: str(form, "quantity"), outcome: str(form, "outcome"), notes: str(form, "notes") });
    await resolvePending(prisma, user, data);
    refreshPanel();
    return data.outcome === "ENCONTRADO" ? "Pendência resolvida: item voltou ao estoque." : "Item baixado como perda.";
  });
}
