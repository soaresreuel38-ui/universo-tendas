import { findContractByToken } from "@/server/contracts";
import { prisma } from "@/server/db";
import { contractPdf, pdfResponse } from "@/server/pdf/render";

/** PDF do contrato para quem tem o link de assinatura válido. */
export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const c = await findContractByToken(prisma, token);
  if (!c) return new Response("Link inválido ou expirado.", { status: 404 });
  const file = await contractPdf(c.id);
  if (!file) return new Response("Não encontrado.", { status: 404 });
  return pdfResponse(file, false);
}
