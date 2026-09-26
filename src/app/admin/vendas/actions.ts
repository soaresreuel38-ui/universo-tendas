"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseMoney } from "@/lib/format";
import { zDateTime, zId, zInt, zMoney, zOptId, zOptText, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { cancelSale, createSale } from "@/server/sales";

export async function createSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  const result = await run(async () => {
    let raw: unknown;
    try {
      raw = JSON.parse(str(form, "items") || "[]");
    } catch {
      throw new DomainError("Lista de produtos inválida.");
    }
    const items = z
      .array(z.object({ productId: zId, quantity: zInt("Quantidade", 1, 100_000), unitPrice: z.string().max(20) }))
      .min(1, "Adicione ao menos um produto.")
      .max(200)
      .parse(raw)
      .map((i) => {
        const cents = i.unitPrice.trim() === "" ? 0 : parseMoney(i.unitPrice);
        if (cents == null) throw new DomainError("Valor unitário inválido (ex.: 150,00).");
        return { productId: i.productId, quantity: i.quantity, unitPriceCents: cents };
      });
    const data = z
      .object({
        customerId: zOptId,
        customerName: zOptText(120),
        soldAt: zDateTime("Data"),
        discountCents: zMoney("Desconto"),
        notes: zOptText(2000),
        paymentMethod: z.enum(["", "DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "BOLETO", "TRANSFERENCIA", "OUTRO"]),
      })
      .parse({
        paymentMethod: str(form, "paymentMethod"),
        customerId: str(form, "customerId"),
        customerName: str(form, "customerName"),
        soldAt: str(form, "soldAt"),
        discountCents: str(form, "discount"),
        notes: str(form, "notes"),
      });
    const { paymentMethod, ...rest } = data;
    const discountCents = data.discountCents ?? 0;
    const total = Math.max(0, items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0) - discountCents);
    const sale = await createSale(prisma, user, {
      ...rest,
      discountCents,
      items,
      payment: paymentMethod && total > 0 ? { method: paymentMethod, amountCents: total } : null,
    });
    id = sale.id;
  });
  if (!result?.ok) return result;
  refreshPanel();
  redirect(`/admin/vendas/${id}?salvo=1`);
}

export async function cancelSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const id = zId.parse(str(form, "id"));
    const reason = zReqText(300, "Motivo").parse(str(form, "reason"));
    await cancelSale(prisma, user, id, reason);
    refreshPanel();
    return "Venda cancelada e produtos devolvidos ao estoque.";
  });
}
