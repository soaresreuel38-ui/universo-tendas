import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { findPublicProduct } from "@/server/public-booking";

/** Modelo 3D de um produto visível no site. Só é baixado quando o cliente pede para ver em 3D. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const product = await findPublicProduct(prisma, slug);
  if (!product) return new Response("Não encontrado.", { status: 404 });
  const model = await prisma.productModel3D.findUnique({ where: { productId: product.id } });
  if (!model) return new Response("Não encontrado.", { status: 404 });
  if (model.blobUrl) return NextResponse.redirect(model.blobUrl, 302);
  const etag = `"${model.updatedAt.getTime().toString(36)}-${model.size}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
  return new Response(new Uint8Array(model.data!), {
    headers: {
      "Content-Type": model.mime,
      "Content-Length": String(model.size),
      "Cache-Control": "public, max-age=86400",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
