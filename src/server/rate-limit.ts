import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";

/**
 * Limite de tentativas de login guardado no banco — funciona mesmo com várias
 * instâncias serverless (a memória de cada instância não é compartilhada).
 */
export async function tooManyAttempts(key: string, limit: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.loginAttempt.count({ where: { key, createdAt: { gte: since } } });
  return count >= limit;
}

export async function recordFailure(key: string) {
  await prisma.loginAttempt.create({ data: { key } });
  // Limpeza oportunista de registros antigos.
  if (Math.random() < 0.05) {
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });
  }
}

export async function clearFailures(key: string) {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
