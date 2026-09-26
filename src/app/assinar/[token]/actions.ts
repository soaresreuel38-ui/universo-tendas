"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { zOptText, zReqText } from "@/lib/validation";
import { run, str } from "@/server/action-utils";
import { signContractByToken } from "@/server/contracts";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { clientIp, recordFailure, tooManyAttempts } from "@/server/rate-limit";

export async function publicSignAction(_: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const ip = await clientIp();
    const key = `sign:${ip}`;
    if (await tooManyAttempts(key, 20, 15 * 60_000)) throw new DomainError("Muitas tentativas. Aguarde alguns minutos.");
    await recordFailure(key); // conta toda tentativa (sucesso ou não) para limitar abuso
    const data = z
      .object({
        token: z.string().min(20).max(64),
        signerName: zReqText(120, "Nome completo"),
        signerDocument: zOptText(30),
        accept: z.literal("on", { message: "Confirme que leu o contrato." }),
        image: z
          .string()
          .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Desenhe sua assinatura.")
          .max(600_000)
          .transform((v) => Buffer.from(v.split(",")[1], "base64")),
      })
      .parse({ token: str(form, "token"), signerName: str(form, "signerName"), signerDocument: str(form, "signerDocument"), accept: str(form, "accept"), image: str(form, "signature") });
    const h = await headers();
    await signContractByToken(prisma, data.token, {
      signerName: data.signerName,
      signerDocument: data.signerDocument,
      imagePng: data.image,
      ip,
      userAgent: h.get("user-agent"),
    });
    return "Assinatura registrada. Obrigado! A Universo Tendas já foi avisada.";
  });
}
