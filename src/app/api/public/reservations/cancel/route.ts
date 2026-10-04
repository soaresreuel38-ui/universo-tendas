import { NextResponse } from "next/server";
import { zOptText } from "@/lib/validation";
import { prisma } from "@/server/db";
import { handlePublicError, jsonError, noStore, rateLimited, readJson } from "@/server/public-api";
import { findRentalByRef, rentalRefSchema, requestCancellation } from "@/server/public-booking";

/**
 * Pedido de cancelamento feito pelo cliente. NÃO cancela nem libera estoque:
 * apenas avisa a empresa, que decide no painel.
 */
export async function POST(request: Request) {
  const limited = await rateLimited("cancelamento", 10, 60 * 60_000);
  if (limited) return limited;
  try {
    const raw = await readJson(request, 4_000);
    const reason = zOptText(1000).parse(String((raw as { reason?: unknown })?.reason ?? ""));
    const rental = await findRentalByRef(prisma, rentalRefSchema.parse(raw));
    if (!rental) return jsonError("Reserva não encontrada.", 404);
    await requestCancellation(prisma, rental.id, reason);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return handlePublicError(e);
  }
}
