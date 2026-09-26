import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return new Response("Não encontrado.", { status: 404 });
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new Response("Não encontrado.", { status: 404 });
  const safeName = doc.fileName.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
