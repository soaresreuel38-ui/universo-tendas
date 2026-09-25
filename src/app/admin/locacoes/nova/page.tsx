import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { addDays, toLocalInput, todayKey, zonedToUtc, TZ } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { rentalFormOptions } from "@/server/rental-form-data";
import { createRentalAction } from "../actions";
import { RentalForm } from "../RentalForm";

export const metadata: Metadata = { title: "Nova locação" };

export default async function NewRentalPage({ searchParams }: { searchParams: Promise<{ saida?: string; produto?: string; cliente?: string }> }) {
  await requirePermission("rental.manage");
  const sp = await searchParams;
  const { customers, products } = await rentalFormOptions();
  const immediate = sp.saida === "1";
  const today = todayKey();
  const departure = immediate ? new Date() : zonedToUtc(addDays(today, 1), "08:00", TZ);
  const ret = zonedToUtc(addDays(today, immediate ? 1 : 2), "18:00", TZ);
  const product = products.find((p) => p.value === sp.produto);
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={immediate ? "Saída para locação" : "Nova locação"}
        description="O sistema verifica a disponibilidade no período antes de salvar."
        back={{ href: "/admin/locacoes", label: "Locações" }}
      />
      <RentalForm
        action={createRentalAction}
        customers={customers}
        products={products}
        immediate={immediate}
        initial={{
          customerId: customers.some((c) => c.value === sp.cliente) ? sp.cliente! : "",
          eventName: "",
          eventAddress: "",
          setupAt: "",
          departureAt: toLocalInput(departure),
          eventAt: "",
          expectedReturnAt: toLocalInput(ret),
          pickupBy: "",
          notes: "",
          discount: "",
          items: product ? [{ productId: product.value, quantity: 1, unitPrice: product.rentalPriceCents != null ? (product.rentalPriceCents / 100).toFixed(2).replace(".", ",") : "" }] : [],
        }}
      />
    </div>
  );
}
