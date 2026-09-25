"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseMoney } from "@/lib/format";
import { zDateTime, zId, zInt, zMoney, zOptDateTime, zOptText, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import {
  changeRentalStatus,
  checkInRental,
  createRental,
  departRental,
  updateRental,
  type RentalInput,
  type UnitReturnState,
} from "@/server/rentals";

const itemsSchema = z
  .array(
    z.object({
      productId: zId,
      quantity: zInt("Quantidade", 1, 100_000),
      unitPrice: z.string().max(20),
    }),
  )
  .min(1, "Adicione ao menos um produto.")
  .max(200);

function parseRental(form: FormData): Omit<RentalInput, "customerId"> {
  let raw: unknown;
  try {
    raw = JSON.parse(str(form, "items") || "[]");
  } catch {
    throw new DomainError("Lista de produtos inválida.");
  }
  const items = itemsSchema.parse(raw).map((i) => {
    const cents = i.unitPrice.trim() === "" ? 0 : parseMoney(i.unitPrice);
    if (cents == null) throw new DomainError("Valor unitário inválido (ex.: 150,00).");
    return { productId: i.productId, quantity: i.quantity, unitPriceCents: cents };
  });
  const base = z
    .object({
      eventName: zReqText(120, "Evento"),
      eventAddress: zOptText(300),
      setupAt: zOptDateTime("Montagem"),
      departureAt: zDateTime("Saída"),
      eventAt: zOptDateTime("Data do evento"),
      expectedReturnAt: zDateTime("Retorno previsto"),
      pickupBy: zOptText(120),
      notes: zOptText(2000),
      discountCents: zMoney("Desconto"),
    })
    .parse({
      eventName: str(form, "eventName"),
      eventAddress: str(form, "eventAddress"),
      setupAt: str(form, "setupAt"),
      departureAt: str(form, "departureAt"),
      eventAt: str(form, "eventAt"),
      expectedReturnAt: str(form, "expectedReturnAt"),
      pickupBy: str(form, "pickupBy"),
      notes: str(form, "notes"),
      discountCents: str(form, "discount"),
    });
  return { ...base, discountCents: base.discountCents ?? 0, items };
}

export async function createRentalAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  let createdCustomerId: string | null = null;
  const result = await run(async () => {
    const data = parseRental(form);
    const status = z.enum(["ORCAMENTO", "RESERVADA", "CONFIRMADA", "SAIU"], { message: "Situação inválida." }).parse(str(form, "status"));
    let customerId = str(form, "customerId");
    if (str(form, "newCustomer") === "1") {
      const c = z
        .object({ name: zReqText(120, "Nome do cliente"), phone: zReqText(30, "Telefone") })
        .parse({ name: str(form, "newCustomerName"), phone: str(form, "newCustomerPhone") });
      const customer = await prisma.customer.create({ data: { name: c.name, phone: c.phone, whatsapp: c.phone } });
      customerId = createdCustomerId = customer.id;
    }
    zId.parse(customerId || "x");
    if (!customerId) throw new DomainError("Selecione o cliente.");
    const rental = await createRental(prisma, user, { ...data, customerId, status });
    id = rental.id;
  });
  if (!result?.ok) {
    // Não deixa cliente criado "pela metade" se a locação foi recusada.
    if (createdCustomerId) await prisma.customer.delete({ where: { id: createdCustomerId } }).catch(() => undefined);
    return result;
  }
  refreshPanel();
  redirect(`/admin/locacoes/${id}?salvo=1`);
}

export async function updateRentalAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = zId.parse(str(form, "id"));
  const result = await run(async () => {
    const data = parseRental(form);
    const customerId = zId.parse(str(form, "customerId"));
    await updateRental(prisma, user, id, { ...data, customerId });
  });
  if (!result?.ok) return result;
  refreshPanel();
  redirect(`/admin/locacoes/${id}?salvo=1`);
}

const STATUSES = ["RESERVADA", "CONFIRMADA", "SEPARACAO", "EM_EVENTO", "AGUARDANDO_RETORNO", "RETORNADA", "FINALIZADA", "CANCELADA"] as const;

export async function changeStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const id = zId.parse(str(form, "id"));
    const to = z.enum(STATUSES, { message: "Status inválido." }).parse(str(form, "to"));
    await changeRentalStatus(prisma, user, id, to);
    refreshPanel();
    return "Status atualizado.";
  });
}

export async function departAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = zId.parse(str(form, "id"));
  const result = await run(async () => {
    const pickupBy = zOptText(120).parse(str(form, "pickupBy"));
    // unit:<productId> = ids das unidades escolhidas
    const unitSelection: Record<string, string[]> = {};
    for (const [key, value] of form.entries()) {
      if (key.startsWith("unit:") && typeof value === "string") {
        const productId = zId.parse(key.slice(5));
        (unitSelection[productId] ??= []).push(zId.parse(value));
      }
    }
    await departRental(prisma, user, id, { pickupBy, unitSelection });
  });
  if (!result?.ok) return result;
  refreshPanel();
  redirect(`/admin/locacoes/${id}?saiu=1`);
}

const checkSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: zId,
        good: zInt("Retornadas", 0),
        damaged: zInt("Danificadas", 0),
        missing: zInt("Faltantes", 0),
        note: zOptText(1000),
        unitStates: z.record(zId, z.enum(["OK", "DANIFICADA", "FALTANTE"])).optional(),
      }),
    )
    .min(1)
    .max(200),
  notes: zOptText(2000),
  returnedAt: zOptDateTime("Data do retorno"),
  photoIds: z.array(zId).max(30),
});

export async function checkInAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = zId.parse(str(form, "id"));
  const result = await run(async () => {
    let items: unknown;
    try {
      items = JSON.parse(str(form, "items") || "[]");
    } catch {
      throw new DomainError("Conferência inválida.");
    }
    const data = checkSchema.parse({
      items,
      notes: str(form, "notes"),
      returnedAt: str(form, "returnedAt"),
      photoIds: form.getAll("photoIds").map(String),
    });
    await checkInRental(prisma, user, id, {
      ...data,
      items: data.items.map((i) => ({ ...i, unitStates: i.unitStates as Record<string, UnitReturnState> | undefined })),
    });
  });
  if (!result?.ok) return result;
  refreshPanel();
  redirect(`/admin/locacoes/${id}?conferida=1`);
}
