import type { Metadata } from "next";
import { LookupForm } from "@/components/site/LookupForm";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { getSiteSettings } from "@/server/site-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha reserva", robots: { index: false, follow: false } };

export default async function MyReservationPage() {
  const settings = await getSiteSettings();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-14 sm:px-6 md:pt-20">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-night/45">Acompanhamento</p>
          <h1 className="mt-4 font-display text-[40px] font-light leading-none tracking-[-0.02em] md:text-[56px]">Minha reserva</h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-night/60">Informe o número da reserva e o telefone usado no pedido. Sem cadastro, sem senha.</p>
        </div>
        <div className="mt-12">
          <LookupForm />
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
