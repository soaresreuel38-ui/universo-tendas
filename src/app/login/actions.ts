"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { getDummyHash, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { clearFailures, clientIp, recordFailure, tooManyAttempts } from "@/server/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
  password: z.string().min(1, "Informe a senha.").max(200),
});

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { email, password } = parsed.data;

  const ip = await clientIp();
  const keys = [`login:email:${email}`, `login:ip:${ip}`];
  if ((await tooManyAttempts(keys[0], 5, 15 * 60_000)) || (await tooManyAttempts(keys[1], 20, 15 * 60_000))) {
    return { ok: false, message: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Compara mesmo quando o e-mail não existe, para não revelar quais e-mails estão cadastrados.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid || !user.active) {
    await Promise.all(keys.map(recordFailure));
    return { ok: false, message: "E-mail ou senha incorretos." };
  }

  await clearFailures(keys[0]);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, user.sessionVersion);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
