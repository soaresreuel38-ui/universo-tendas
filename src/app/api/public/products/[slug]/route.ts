import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/public-api";
import { findPublicProduct } from "@/server/public-booking";
import { serializeProduct } from "@/server/public-serialize";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const product = await findPublicProduct(prisma, slug);
  if (!product) return jsonError("Produto não encontrado.", 404);
  return NextResponse.json({ product: serializeProduct(product) }, { headers: { "Cache-Control": "no-store" } });
}
