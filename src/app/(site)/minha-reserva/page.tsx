import type { Metadata } from "next";
import { LookupForm } from "@/components/site/LookupForm";
import { PageIntro } from "@/components/site/PageIntro";
import { SiteFooter } from "@/components/site/SiteChrome";
import { getSiteSettings } from "@/server/site-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha reserva", robots: { index: false, follow: false } };

export default async function MyReservationPage() {
  const settings = await getSiteSettings();
  return (
    <>
      <PageIntro
        eyebrow="Acompanhamento"
        title="Minha reserva"
        text="Informe o número da reserva e o telefone usado no pedido. Sem cadastro, sem senha."
      />
      <main className="mx-auto max-w-2xl px-5 pb-28 pt-14 sm:px-6 md:pt-20">
        <LookupForm />
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
