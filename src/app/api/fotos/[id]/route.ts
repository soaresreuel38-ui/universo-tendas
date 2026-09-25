import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado.", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return new NextResponse("Não encontrada.", { status: 404 });
  const photo = await prisma.photo.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!photo) return new NextResponse("Não encontrada.", { status: 404 });
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
