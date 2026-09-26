import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado.", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) return new NextResponse("Não encontrada.", { status: 404 });
  // ?s=t → miniatura (quando existir); sem ela, a foto inteira.
  if (request.nextUrl.searchParams.get("s") === "t") {
    const t = await prisma.photo.findUnique({ where: { id }, select: { thumb: true, thumbMime: true } });
    if (!t) return new NextResponse("Não encontrada.", { status: 404 });
    if (t.thumb && t.thumbMime) return send(t.thumb, t.thumbMime);
  }
  const photo = await prisma.photo.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!photo) return new NextResponse("Não encontrada.", { status: 404 });
  return send(photo.data, photo.mime);
}

function send(bytes: Uint8Array, mime: string) {
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
