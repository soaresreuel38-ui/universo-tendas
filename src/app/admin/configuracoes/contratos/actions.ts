"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { zOptText, zReqText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";

const clauseSchema = z.array(z.object({ title: zReqText(160, "Título da cláusula"), body: z.string().max(8000, "Cláusula muito longa.") })).max(60);

export async function saveContractTemplateAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("settings.manage");
  return run(async () => {
    let raw: unknown;
    try {
      raw = JSON.parse(str(form, "clauses") || "[]");
    } catch {
      raw = [];
    }
    const clauses = clauseSchema.parse(raw).map((c) => ({ title: c.title, body: c.body.replace(/\r/g, "").trim() }));
    const data = z
      .object({
        companyName: zReqText(120, "Nome da empresa"),
        cnpj: zOptText(30),
        address: zOptText(300),
        city: zReqText(120, "Cidade"),
        phones: zReqText(200, "Telefones"),
        email: zOptText(160),
        instagram: zReqText(80, "Instagram"),
        intro: zOptText(4000),
        defaultPaymentTerms: zOptText(1000),
        footer: zOptText(1000),
      })
      .parse(Object.fromEntries(["companyName", "cnpj", "address", "city", "phones", "email", "instagram", "intro", "defaultPaymentTerms", "footer"].map((k) => [k, str(form, k)])));
    await prisma.$transaction(async (tx) => {
      await tx.contractTemplate.upsert({
        where: { id: "default" },
        update: { ...data, clauses, updatedById: user.id },
        create: { id: "default", ...data, clauses, updatedById: user.id },
      });
      await audit(tx, { userId: user.id, action: "settings.contract_template", entityType: "Settings", entityId: "contract-template", summary: `Alterou o modelo de contrato (${clauses.length} cláusulas)` });
    });
    refreshPanel();
    return "Modelo salvo. Novos contratos (e rascunhos atualizados) usarão este texto.";
  });
}
