import { NextResponse, type NextRequest } from "next/server";
import { fromLocalInput } from "@/lib/time";
import { getCurrentUser } from "@/server/auth/session";
import { availabilityForPeriod } from "@/server/availability";
import { prisma } from "@/server/db";

/**
 * Consulta usada pelo formulário de locação para avisar na hora.
 * É só uma conveniência: o servidor valida de novo, com trava, antes de salvar.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const from = fromLocalInput(sp.get("de") ?? "");
  const to = fromLocalInput(sp.get("ate") ?? "");
  const ids = (sp.get("ids") ?? "").split(",").filter((id) => /^[a-z0-9]{1,40}$/i.test(id)).slice(0, 200);
  const exclude = sp.get("excluir") ?? undefined;
  if (!from || !to || to <= from || ids.length === 0) return NextResponse.json({ items: {} });
  const map = await availabilityForPeriod(prisma, ids, from, to, {
    excludeRentalId: exclude && /^[a-z0-9]{1,40}$/i.test(exclude) ? exclude : undefined,
  });
  const items: Record<string, number> = {};
  for (const [id, a] of map) items[id] = a.free;
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
