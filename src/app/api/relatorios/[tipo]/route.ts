import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/domain";
import { getCurrentUser } from "@/server/auth/session";
import { reportData, reportTable, resolvePeriod, toCsv } from "@/server/reports";

export async function GET(request: NextRequest, ctx: { params: Promise<{ tipo: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado.", { status: 401 });
  if (!can(user.role, "report.view")) return new NextResponse("Sem permissão.", { status: 403 });
  const { tipo } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  const period = resolvePeriod(sp.get("periodo") ?? undefined, sp.get("de") ?? undefined, sp.get("ate") ?? undefined);
  const table = reportTable(tipo, await reportData(period));
  if (!table) return new NextResponse("Relatório não encontrado.", { status: 404 });
  return new NextResponse(toCsv(table.header, table.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${table.name}_${period.from}_${period.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
