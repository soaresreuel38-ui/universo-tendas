import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { isPublicPhoto } from "@/server/public-booking";

/** Fotos de produtos visíveis no site (somente essas). ?s=t devolve a miniatura. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{1,40}$/i.test(id) || !(await isPublicPhoto(prisma, id))) return new NextResponse("Não encontrada.", { status: 404 });
  if (request.nextUrl.searchParams.get("s") === "t") {
    const t = await prisma.photo.findUnique({ where: { id }, select: { thumb: true, thumbMime: true } });
    if (t?.thumb && t.thumbMime) return send(t.thumb, t.thumbMime);
  }
  const photo = await prisma.photo.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!photo) return new NextResponse("Não encontrada.", { status: 404 });
  return send(photo.data, photo.mime);
}

function send(bytes: Uint8Array, mime: string) {
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      // O conteúdo de uma foto nunca muda (foto nova = id novo): pode ficar em cache.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
