import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handlePublicError, jsonError, noStore, rateLimited, readJson } from "@/server/public-api";
import { findRentalByRef, rentalRefSchema } from "@/server/public-booking";
import { serializeRental } from "@/server/public-rental-view";

/** Consulta da reserva pelo cliente: número + telefone (POST para não expor o telefone na URL), ou token. */
export async function POST(request: Request) {
  const limited = await rateLimited("consulta", 30, 15 * 60_000);
  if (limited) return limited;
  try {
    const ref = rentalRefSchema.parse(await readJson(request, 2_000));
    const rental = await findRentalByRef(prisma, ref);
    if (!rental) return jsonError("Não encontramos uma reserva com esses dados. Confira o número e o telefone usados no pedido.", 404);
    const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    return NextResponse.json({ rental: serializeRental(rental, settings) }, { headers: noStore });
  } catch (e) {
    return handlePublicError(e);
  }
}
