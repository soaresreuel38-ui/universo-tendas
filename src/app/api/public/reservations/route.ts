import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handlePublicError, jsonError, noStore, rateLimited, readJson } from "@/server/public-api";
import { createOnlineReservation } from "@/server/public-booking";

/**
 * Cria a reserva de verdade no banco (mesmo PostgreSQL e mesma regra do painel).
 * Status conforme Configurações: RESERVADA aguardando aprovação (padrão) ou CONFIRMADA.
 */
export async function POST(request: Request) {
  const limited = await rateLimited("reserva", 8, 60 * 60_000);
  if (limited) return limited;
  try {
    const body = await readJson(request);
    // Campo "armadilha": invisível para pessoas, costuma ser preenchido por robôs.
    if (body && typeof body === "object" && (body as { website?: unknown }).website) {
      return jsonError("Não foi possível concluir o pedido.", 400);
    }
    const r = await createOnlineReservation(prisma, body);
    return NextResponse.json({ ok: true, code: r.code, token: r.token, status: r.status }, { status: 201, headers: noStore });
  } catch (e) {
    return handlePublicError(e);
  }
}
