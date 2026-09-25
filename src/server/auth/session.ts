import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type Permission } from "@/lib/domain";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/errors";
import { SESSION_COOKIE, SESSION_TTL_SEC, signSession, verifySession } from "./token";

export async function createSession(userId: string, sessionVersion: number) {
  const token = await signSession({ sub: userId, ver: sessionVersion });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = Actor & { email: string };

/**
 * Valida o token e relê o usuário no banco a cada requisição: usuário desativado,
 * senha trocada ou papel alterado têm efeito imediato.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, role: true, active: true, sessionVersion: true },
  });
  if (!user || !user.active || user.sessionVersion !== session.ver) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** Use em toda página e server action do painel (defesa em profundidade além do proxy). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Página restrita: sem permissão, volta ao painel. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/admin?negado=1");
  return user;
}
