"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { zId } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import { addProductImages, removeProductImage, removeProductModel, setMainImage, updateModelView } from "@/server/catalog";
import { prisma } from "@/server/db";

export async function addImagesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const productId = zId.parse(str(form, "productId"));
    const ids = z.array(zId).min(1, "Adicione ao menos uma foto.").max(30).parse(form.getAll("photoIds").map(String));
    await addProductImages(prisma, user, productId, ids);
    refreshPanel();
    return "Fotos adicionadas à galeria.";
  });
}

export async function removeImageAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    await removeProductImage(prisma, user, zId.parse(str(form, "productId")), zId.parse(str(form, "photoId")));
    refreshPanel();
    return "Foto removida.";
  });
}

export async function mainImageAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    await setMainImage(prisma, user, zId.parse(str(form, "productId")), zId.parse(str(form, "photoId")));
    refreshPanel();
    return "Foto principal definida.";
  });
}

const vec = z.tuple([z.number(), z.number(), z.number()]).nullable();

export async function saveModelViewAction(productId: string, view: unknown): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const parsed = z.object({ cameraPosition: vec, cameraTarget: vec, scale: z.number(), rotationY: z.number() }).safeParse(view);
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const r = await run(async () => {
    await updateModelView(prisma, user, zId.parse(productId), parsed.data);
    refreshPanel();
    return "Apresentação do modelo salva.";
  });
  return { ok: Boolean(r?.ok), message: r?.message ?? "" };
}

export async function removeModelAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    await removeProductModel(prisma, user, zId.parse(str(form, "productId")));
    refreshPanel();
    return "Modelo 3D removido.";
  });
}
