"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { zInt, zOptText, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requirePermission("settings.manage");
  return run(async () => {
    const data = z
      .object({
        companyName: zReqText(120, "Nome da empresa"),
        city: zReqText(120, "Cidade"),
        phones: zReqText(200, "Telefones"),
        whatsappNumber: z.string().trim().regex(/^\d{12,13}$/, "WhatsApp: use só números com DDI e DDD (ex.: 5566999824544)."),
        instagram: zReqText(80, "Instagram"),
        address: zOptText(300),
        defaultMinStock: zInt("Estoque mínimo padrão", 0, 100_000),
        whatsappFooter: zReqText(300, "Assinatura"),
      })
      .parse({
        companyName: str(form, "companyName"),
        city: str(form, "city"),
        phones: str(form, "phones"),
        whatsappNumber: str(form, "whatsappNumber").replace(/\D/g, ""),
        instagram: str(form, "instagram"),
        address: str(form, "address"),
        defaultMinStock: str(form, "defaultMinStock") || "0",
        whatsappFooter: str(form, "whatsappFooter"),
      });
    await prisma.businessSettings.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
    refreshPanel();
    return "Configurações salvas.";
  });
}
