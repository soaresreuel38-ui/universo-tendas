import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError } from "./errors";
import { clientIp, recordFailure, tooManyAttempts } from "./rate-limit";

/**
 * Utilidades das rotas públicas (/api/public/*). Elas não têm login, então:
 * - toda entrada é validada no servidor;
 * - as operações que gravam têm limite por IP (guardado no banco, funciona em serverless);
 * - erros inesperados nunca expõem detalhes internos.
 */

export const noStore = { "Cache-Control": "no-store" } as const;

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: noStore });
}

/** Limite de uso por IP. Registra a tentativa e responde 429 quando passa do limite. */
export async function rateLimited(bucket: string, limit: number, windowMs: number): Promise<NextResponse | null> {
  const key = `public:${bucket}:${await clientIp()}`;
  if (await tooManyAttempts(key, limit, windowMs)) {
    return jsonError("Muitas tentativas em pouco tempo. Aguarde alguns minutos ou fale com a gente pelo WhatsApp.", 429);
  }
  await recordFailure(key);
  return null;
}

export async function readJson(request: Request, maxBytes = 20_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new DomainError("Pedido grande demais.");
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("Dados inválidos.");
  }
}

/** Converte erros de regra/validação em resposta amigável; o resto vira 500 genérico. */
export function handlePublicError(error: unknown) {
  if (error instanceof DomainError) return jsonError(error.message, 409);
  if (error instanceof z.ZodError) return jsonError(error.issues[0]?.message ?? "Dados inválidos.", 400);
  console.error(error);
  return jsonError("Não foi possível concluir agora. Tente novamente em instantes.", 500);
}
