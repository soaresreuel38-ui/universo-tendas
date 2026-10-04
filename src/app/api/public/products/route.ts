import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { listPublicProducts } from "@/server/public-booking";
import { serializeProduct } from "@/server/public-serialize";

/** Catálogo público: produtos ativos de locação marcados para aparecer no site. */
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("categoria")?.slice(0, 60) || null;
  const products = await listPublicProducts(prisma, { category });
  return NextResponse.json({ products: products.map(serializeProduct) }, { headers: { "Cache-Control": "no-store" } });
}
