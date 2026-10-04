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
import { createContractFromRental } from "@/server/contracts";
import { registerRentalPayment } from "@/server/payments";
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
      teardownAt: zOptDateTime("Desmontagem"),
      paymentTerms: zOptText(1000),
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
      teardownAt: str(form, "teardownAt"),
      paymentTerms: str(form, "paymentTerms"),
    });
  // Modalidade: opcional (formulários antigos não enviam; na edição, mantém a atual).
  const mode = str(form, "billingMode");
  const periods = str(form, "periodCount");
  const billing = z
    .object({
      billingMode: z.enum(["DIARIA", "MENSAL"], { message: "Modalidade inválida." }).optional(),
      periodCount: zInt("Quantidade de diárias/meses", 1, 3650).optional(),
    })
    .parse({ billingMode: mode || undefined, periodCount: periods || undefined });
  return { ...base, ...billing, discountCents: base.discountCents ?? 0, items };
}

const newCustomerSchema = z.object({
  name: zReqText(120, "Nome do cliente"),
  document: zOptText(20),
  phone: zOptText(30),
  whatsapp: zOptText(30),
  email: z.string().trim().max(160).transform((v) => v || null).pipe(z.string().email("E-mail do cliente inválido.").nullable()),
  address: zOptText(300),
  city: zOptText(120),
  notes: zOptText(2000),
});

export async function createRentalAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  let contractId = "";
  let createdCustomerId: string | null = null;
  const result = await run(async () => {
    const data = parseRental(form);
    const status = z.enum(["ORCAMENTO", "RESERVADA", "CONFIRMADA", "SAIU"], { message: "Situação inválida." }).parse(str(form, "status"));
    const andContract = str(form, "andContract") === "1";
    let customerId = str(form, "customerId");
    if (str(form, "newCustomer") === "1") {
      const c = newCustomerSchema.parse({
        name: str(form, "newCustomerName"),
        document: str(form, "newCustomerDocument"),
        phone: str(form, "newCustomerPhone"),
        whatsapp: str(form, "newCustomerWhatsapp") || str(form, "newCustomerPhone"),
        email: str(form, "newCustomerEmail"),
        address: str(form, "newCustomerAddress"),
        city: str(form, "newCustomerCity"),
        notes: str(form, "newCustomerNotes"),
      });
      if (!c.phone && !c.whatsapp) throw new DomainError("Informe o telefone ou WhatsApp do cliente.");
      const customer = await prisma.customer.create({ data: c });
      customerId = createdCustomerId = customer.id;
    }
    if (!customerId) throw new DomainError("Selecione o cliente.");
    zId.parse(customerId);
    const rental = await createRental(prisma, user, { ...data, customerId, status: andContract ? "ORCAMENTO" : status });
    id = rental.id;
    if (andContract) contractId = (await createContractFromRental(prisma, user, rental.id)).id;
  });
  if (!result?.ok) {
    // Não deixa cliente criado "pela metade" se a locação foi recusada.
    if (createdCustomerId && !id) await prisma.customer.delete({ where: { id: createdCustomerId } }).catch(() => undefined);
    // Locação criada mas contrato recusado (ex.: estoque): mantém como orçamento e mostra o motivo.
    if (id) redirect(`/admin/locacoes/${id}?erro=${encodeURIComponent(result?.message ?? "")}`);
    return result;
  }
  refreshPanel();
  if (contractId) redirect(`/admin/contratos/${contractId}?gerado=1`);
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
        damage: z
          .object({
            damageType: zReqText(80, "Tipo de dano"),
            responsible: zOptText(120),
            photoIds: z.array(zId).max(20).default([]),
          })
          .optional(),
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

export async function registerPaymentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({
        rentalId: zId,
        amount: zMoney("Valor"),
        method: z.enum(["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "BOLETO", "TRANSFERENCIA", "OUTRO"]),
      })
      .parse({ rentalId: str(form, "rentalId"), amount: str(form, "amount"), method: str(form, "method") });
    if (!data.amount) throw new DomainError("Informe o valor.");
    await registerRentalPayment(prisma, user, data.rentalId, { amountCents: data.amount, method: data.method });
    refreshPanel();
    return "Pagamento registrado.";
  });
}
