"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { zCheckbox, zId, zInt, zMoney, zOptId, zOptText, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createProduct, deleteOrDeactivateProduct, setProductActive, updateProduct } from "@/server/products";

const productSchema = z.object({
  name: zReqText(120, "Nome"),
  sku: zReqText(40, "Código/SKU").pipe(z.string().regex(/^[\w.\-/ ]+$/, "Código/SKU: use letras, números, espaço, ponto, hífen ou barra.")),
  category: zReqText(60, "Categoria"),
  kind: z.enum(["RENTAL", "SALE", "BOTH"], { message: "Tipo inválido." }),
  trackingMode: z.enum(["QUANTITY", "UNIT"], { message: "Modo de controle inválido." }),
  description: zOptText(2000),
  unit: zReqText(20, "Unidade"),
  rentalPriceCents: zMoney("Preço da diária"),
  monthlyPriceCents: zMoney("Preço mensal"),
  salePriceCents: zMoney("Preço de venda"),
  minStock: zInt("Estoque mínimo", 0, 100_000),
  photoId: zOptId,
  notes: zOptText(2000),
  dimensions: zOptText(120),
  active: zCheckbox,
  slug: zOptText(80).pipe(z.string().regex(/^[a-z0-9-]+$/, "Endereço da página: use só letras minúsculas, números e hífen.").nullable()),
  showOnSite: zCheckbox,
  featured: zCheckbox,
});

function parseProduct(form: FormData) {
  return productSchema.parse({
    name: str(form, "name"),
    sku: str(form, "sku"),
    category: str(form, "category"),
    kind: str(form, "kind"),
    trackingMode: str(form, "trackingMode"),
    description: str(form, "description"),
    unit: str(form, "unit") || "un",
    rentalPriceCents: str(form, "rentalPrice"),
    monthlyPriceCents: str(form, "monthlyPrice"),
    salePriceCents: str(form, "salePrice"),
    minStock: str(form, "minStock") || "0",
    photoId: str(form, "photoId"),
    notes: str(form, "notes"),
    dimensions: str(form, "dimensions"),
    active: form.get("active"),
    slug: str(form, "slug").toLowerCase(),
    showOnSite: form.get("showOnSite"),
    featured: form.get("featured"),
  });
}

export async function createProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  const result = await run(async () => {
    const data = parseProduct(form);
    const initialQty = zInt("Quantidade inicial", 0, 100_000).parse(str(form, "initialQty") || "0");
    const p = await createProduct(prisma, user, { ...data, initialQty });
    id = p.id;
  });
  if (!result?.ok) return result;
  refreshPanel();
  redirect(`/admin/produtos/${id}?salvo=1`);
}

export async function updateProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = zId.parse(str(form, "id"));
  const result = await run(async () => {
    await updateProduct(prisma, user, id, parseProduct(form));
  });
  if (!result?.ok) return result;
  refreshPanel();
  redirect(`/admin/produtos/${id}?salvo=1`);
}

export async function deleteProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = zId.parse(str(form, "id"));
  let outcome = "";
  const result = await run(async () => {
    outcome = await deleteOrDeactivateProduct(prisma, user, id);
  });
  if (!result?.ok) return result;
  refreshPanel();
  if (outcome === "deleted") redirect("/admin/produtos?excluido=1");
  return { ok: true, message: "O produto tem histórico, por isso foi desativado (o histórico foi mantido)." };
}

export async function reactivateProductAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = zId.parse(str(form, "id"));
  return run(async () => {
    await setProductActive(prisma, user, id, true);
    refreshPanel();
    return "Produto reativado.";
  });
}
