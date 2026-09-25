"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { run, str } from "@/server/action-utils";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  return run(async () => {
    const data = z
      .object({
        current: z.string().min(1, "Informe a senha atual.").max(200),
        next: z.string().min(10, "A nova senha precisa ter ao menos 10 caracteres.").max(200),
        confirm: z.string(),
      })
      .refine((v) => v.next === v.confirm, "A confirmação não confere.")
      .parse({ current: str(form, "current"), next: str(form, "next"), confirm: str(form, "confirm") });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(data.current, user.passwordHash))) throw new DomainError("Senha atual incorreta.");
    const updated = await prisma.user.update({
      where: { id: me.id },
      data: { passwordHash: await hashPassword(data.next), sessionVersion: { increment: 1 } },
    });
    // Outras sessões abertas deixam de valer; esta continua com um novo token.
    await createSession(updated.id, updated.sessionVersion);
    return "Senha alterada.";
  });
}
