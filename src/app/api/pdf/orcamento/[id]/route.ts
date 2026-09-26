import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { quotePdf, pdfResponse } from "@/server/pdf/render";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return new Response("Não encontrado.", { status: 404 });
  const file = await quotePdf(id);
  if (!file) return new Response("Não encontrado.", { status: 404 });
  return pdfResponse(file, request.nextUrl.searchParams.get("baixar") === "1");
}
