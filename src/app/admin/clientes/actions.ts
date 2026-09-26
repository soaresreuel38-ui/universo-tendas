"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { cleanText, zId, zOptText, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import { deleteCustomer, saveCustomer } from "@/server/customers";
import { prisma } from "@/server/db";

const schema = z.object({
  name: zReqText(120, "Nome"),
  document: zOptText(20).pipe(z.string().regex(/^[\d./-]*$/, "CPF/CNPJ: use apenas números, ponto, barra e hífen.").nullable()),
  phone: zOptText(30),
  whatsapp: zOptText(30),
  email: z
    .string()
    .transform(cleanText)
    .pipe(z.union([z.literal(""), z.string().email("E-mail inválido.").max(160)]))
    .transform((v) => v || null),
  address: zOptText(300),
  city: zOptText(120),
  notes: zOptText(2000),
});

const parse = (form: FormData) =>
  schema.parse({
    name: str(form, "name"),
    document: str(form, "document"),
    phone: str(form, "phone"),
    whatsapp: str(form, "whatsapp"),
    email: str(form, "email"),
    address: str(form, "address"),
    city: str(form, "city"),
    notes: str(form, "notes"),
  });

export async function saveCustomerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const rawId = str(form, "id");
  let id = rawId;
  const result = await run(async () => {
    const c = await saveCustomer(prisma, user, parse(form), rawId ? zId.parse(rawId) : undefined);
    id = c.id;
  });
  if (!result?.ok) return result;
  refreshPanel();
  if (!rawId) redirect(`/admin/clientes/${id}`);
  return { ok: true, message: "Cliente atualizado." };
}

export async function deleteCustomerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let outcome = "";
  const result = await run(async () => {
    outcome = await deleteCustomer(prisma, user, zId.parse(str(form, "id")));
  });
  if (!result?.ok) return result;
  refreshPanel();
  if (outcome === "deleted") redirect("/admin/clientes");
  return { ok: true, message: "Cliente com histórico: foi desativado (o histórico foi mantido)." };
}
