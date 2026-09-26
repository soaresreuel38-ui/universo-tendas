"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { fmtDateTime, seq, whatsappLink } from "@/lib/format";
import { zId, zReqText, zOptText } from "@/lib/validation";
import { refreshPanel, run, str } from "@/server/action-utils";
import { requireUser } from "@/server/auth/session";
import {
  cancelContract,
  createContractFromRental,
  createSignLink,
  markContractSent,
  refreshContract,
  registerManualSignature,
  signContractInPerson,
} from "@/server/contracts";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";

export async function createContractAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const rentalId = zId.parse(str(form, "rentalId"));
  let id = "";
  const result = await run(async () => {
    id = (await createContractFromRental(prisma, user, rentalId)).id;
  });
  if (!result?.ok) return result;
  refreshPanel();
  redirect(`/admin/contratos/${id}?gerado=1`);
}

export async function refreshContractAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    await refreshContract(prisma, user, zId.parse(str(form, "id")));
    refreshPanel();
    return "Rascunho atualizado com os dados atuais da locação.";
  });
}

export async function markSentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    await markContractSent(prisma, user, zId.parse(str(form, "id")));
    refreshPanel();
    return "Contrato marcado como enviado.";
  });
}

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Gera o link de assinatura e devolve a URL do WhatsApp com a mensagem pronta (não envia nada sozinho). */
export async function whatsappContractAction(contractId: string): Promise<{ ok: boolean; url?: string; message: string }> {
  const user = await requireUser();
  try {
    const id = zId.parse(contractId);
    const c = await prisma.contract.findUnique({ where: { id }, include: { customer: true, rental: true } });
    if (!c) throw new DomainError("Contrato não encontrado.");
    const phone = c.customer.whatsapp || c.customer.phone;
    if (!phone) throw new DomainError("O cliente não tem WhatsApp/telefone cadastrado.");
    const token = await createSignLink(prisma, user, id);
    const link = `${await baseUrl()}/assinar/${token}`;
    const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    const text = [
      `Olá, ${c.customer.name}.`,
      "",
      `Segue o contrato referente à sua locação na ${settings?.companyName ?? "Universo Tendas"}.`,
      "",
      `Contrato: #${seq(c.number)}`,
      ...(c.rental ? [`Evento: ${c.rental.eventName}`, `Data: ${fmtDateTime(c.rental.eventAt ?? c.rental.departureAt)}`] : []),
      "",
      `Para ler e assinar: ${link}`,
      "",
      "Obrigado,",
      settings?.whatsappFooter ?? "Universo Tendas",
    ].join("\n");
    const url = whatsappLink(phone, text);
    if (!url) throw new DomainError("Telefone do cliente inválido para WhatsApp.");
    refreshPanel();
    return { ok: true, url, message: "Mensagem pronta no WhatsApp. Confira e envie." };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    if (e instanceof z.ZodError) return { ok: false, message: "Contrato inválido." };
    throw e;
  }
}

const zSignature = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Desenhe a assinatura.")
  .max(600_000, "Assinatura muito grande.")
  .transform((v) => Buffer.from(v.split(",")[1], "base64"));

export async function signInPersonAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const data = z
      .object({
        id: zId,
        party: z.enum(["CLIENTE", "EMPRESA"]),
        signerName: zReqText(120, "Nome de quem assina"),
        signerDocument: zOptText(30),
        image: zSignature,
      })
      .parse({ id: str(form, "id"), party: str(form, "party"), signerName: str(form, "signerName"), signerDocument: str(form, "signerDocument"), image: str(form, "signature") });
    const h = await headers();
    const c = await signContractInPerson(prisma, user, data.id, {
      party: data.party,
      signerName: data.signerName,
      signerDocument: data.signerDocument,
      imagePng: data.image,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    });
    refreshPanel();
    return c.status === "ASSINADO" || c.status === "ATIVO" ? "Assinatura registrada. Contrato assinado pelas duas partes." : "Assinatura registrada.";
  });
}

const DOC_MIME: Record<string, (b: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8,
  "image/png": (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
};

export async function manualSignatureAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    const id = zId.parse(str(form, "id"));
    const clientName = zReqText(120, "Nome do cliente").parse(str(form, "clientName"));
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new DomainError("Anexe o contrato assinado (PDF ou foto).");
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = Object.keys(DOC_MIME).find((m) => DOC_MIME[m](buf));
    if (!mime) throw new DomainError("Formato não suportado. Envie PDF, JPG ou PNG.");
    await registerManualSignature(prisma, user, id, { file: buf, mime, fileName: file.name || "contrato-assinado", clientName });
    refreshPanel();
    return "Contrato assinado em papel anexado. Contrato marcado como assinado.";
  });
}

export async function cancelContractAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  return run(async () => {
    await cancelContract(prisma, user, zId.parse(str(form, "id")), zReqText(300, "Motivo").parse(str(form, "reason")));
    refreshPanel();
    return "Contrato cancelado.";
  });
}
