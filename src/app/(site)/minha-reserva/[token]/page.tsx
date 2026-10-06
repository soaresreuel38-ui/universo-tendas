import type { Metadata } from "next";
import Link from "next/link";
import { ReservationView } from "@/components/site/ReservationView";
import { SiteHeader } from "@/components/site/SiteChrome";
import { prisma } from "@/server/db";
import { findRentalByToken } from "@/server/public-booking";
import { serializeRental } from "@/server/public-rental-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha reserva", robots: { index: false, follow: false } };

/** Confirmação e acompanhamento pelo link pessoal (o token só existe no link enviado a quem reservou). */
export default async function ReservationByTokenPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nova?: string }> }) {
  const [{ token }, { nova }] = await Promise.all([params, searchParams]);
  const rental = await findRentalByToken(prisma, token);
  const settings = rental ? await prisma.businessSettings.findUnique({ where: { id: "default" } }) : null;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-6 md:pt-16">
        {rental ? (
          <>
            <ReservationView rental={serializeRental(rental, settings)} reference={{ token }} fresh={nova === "1"} />
            <p className="mt-12 border-t border-night/12 pt-6 text-center text-[13px] leading-relaxed text-night/60">
              Guarde o número <b className="text-night">#{serializeRental(rental, settings).code}</b>. Para consultar depois, use{" "}
              <Link href="/minha-reserva" className="underline underline-offset-4">Minha reserva</Link> com o número e o telefone informado, ou salve este link.
            </p>
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="text-[24px] font-semibold uppercase tracking-[0.01em]">Link de reserva inválido.</p>
            <p className="mt-3 text-night/60">Consulte pelo número da reserva e o telefone informado no pedido.</p>
            <Link href="/minha-reserva" className="mt-8 inline-flex h-14 items-center bg-night px-8 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-white hover:bg-night-soft">
              Consultar minha reserva
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
