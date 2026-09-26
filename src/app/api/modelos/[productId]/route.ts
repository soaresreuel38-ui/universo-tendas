import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/domain";
import { getCurrentUser } from "@/server/auth/session";
import { MODEL_MAX_DB_BYTES, saveProductModel } from "@/server/catalog";
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";

const validId = (id: string) => /^[a-z0-9]{1,40}$/i.test(id);

/** Serve o modelo 3D. Cache no navegador pela versão (updatedAt) para não baixar de novo. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const { productId } = await ctx.params;
  if (!validId(productId)) return new Response("Não encontrado.", { status: 404 });
  const model = await prisma.productModel3D.findUnique({ where: { productId } });
  if (!model) return new Response("Não encontrado.", { status: 404 });
  if (model.blobUrl) return NextResponse.redirect(model.blobUrl, 302);
  const etag = `"${model.updatedAt.getTime().toString(36)}-${model.size}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
  return new Response(new Uint8Array(model.data!), {
    headers: {
      "Content-Type": model.mime,
      "Content-Length": String(model.size),
      "Cache-Control": "private, max-age=86400",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ productId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!can(user.role, "product.manage")) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const { productId } = await ctx.params;
  if (!validId(productId)) return NextResponse.json({ error: "Produto inválido." }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie o arquivo .glb ou .gltf." }, { status: 400 });
  if (file.size > MODEL_MAX_DB_BYTES) {
    return NextResponse.json({ error: "Modelo com mais de 4 MB. Otimize o arquivo (texturas menores, compressão Meshopt) e envie novamente." }, { status: 413 });
  }
  try {
    const data = Buffer.from(await file.arrayBuffer());
    const model = await saveProductModel(prisma, user, productId, { data, size: data.length, fileName: file.name || "modelo.glb" });
    return NextResponse.json({ ok: true, size: model.size });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
