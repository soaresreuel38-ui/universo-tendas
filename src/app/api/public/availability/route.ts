import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { handlePublicError, jsonError, noStore } from "@/server/public-api";
import { publicAvailability } from "@/server/public-booking";

/**
 * Disponibilidade para o período do evento: GET ?ids=a,b&inicio=2026-10-10&fim=2026-10-12
 * Usa availabilityForPeriod() — a mesma regra do painel. É só uma prévia para o cliente:
 * ao confirmar, o servidor valida de novo com trava no banco.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const ids = (sp.get("ids") ?? "").split(",").filter((id) => /^[a-z0-9]{1,40}$/i.test(id)).slice(0, 50);
  if (ids.length === 0) return jsonError("Informe o produto.");
  try {
    const { free, window } = await publicAvailability(prisma, ids, sp.get("inicio") ?? "", sp.get("fim") ?? "");
    return NextResponse.json(
      { free, blockedFrom: window.departureAt.toISOString(), blockedUntil: window.expectedReturnAt.toISOString() },
      { headers: noStore },
    );
  } catch (e) {
    return handlePublicError(e);
  }
}
