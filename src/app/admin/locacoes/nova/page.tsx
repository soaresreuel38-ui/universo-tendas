import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { modelView } from "@/lib/model-view";
import { addDays, toLocalInput, todayKey, zonedToUtc, TZ } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createRentalAction } from "../actions";
import { RentalWizard } from "./RentalWizard";

export const metadata: Metadata = { title: "Nova locação" };

export default async function NewRentalPage({ searchParams }: { searchParams: Promise<{ saida?: string; produto?: string; cliente?: string; orcamento?: string }> }) {
  await requirePermission("rental.manage");
  const sp = await searchParams;
  const [customers, products, template] = await Promise.all([
    prisma.customer.findMany({
      where: { active: true },
      select: { id: true, name: true, document: true, phone: true, whatsapp: true, email: true, address: true, city: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true, kind: { in: ["RENTAL", "BOTH"] } },
      include: { model3d: { omit: { data: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: { name: "asc" },
    }),
    prisma.contractTemplate.findUnique({ where: { id: "default" }, select: { defaultPaymentTerms: true } }),
  ]);
  const immediate = sp.saida === "1";
  const today = todayKey();
  const departure = immediate ? new Date() : zonedToUtc(addDays(today, 1), "08:00", TZ);
  const ret = zonedToUtc(addDays(today, immediate ? 1 : 2), "18:00", TZ);

  return (
    <div className="pb-28">
      <PageHeader
        eyebrow="Operação"
        title={immediate ? "Saída para locação" : sp.orcamento === "1" ? "Novo orçamento" : "Nova locação"}
        description="Cliente → período → produtos → revisão. A disponibilidade é conferida em tempo real e de novo ao salvar."
        back={{ href: "/admin/locacoes", label: "Locações" }}
      />
      <RentalWizard
        action={createRentalAction}
        customers={customers}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          unit: p.unit,
          dimensions: p.dimensions,
          rentalPriceCents: p.rentalPriceCents,
          photoId: p.photoId ?? p.images[0]?.photoId ?? null,
          model: modelView(p.id, p.model3d),
        }))}
        defaults={{
          departureAt: toLocalInput(departure),
          expectedReturnAt: toLocalInput(ret),
          customerId: customers.some((c) => c.id === sp.cliente) ? sp.cliente : undefined,
          productId: products.some((p) => p.id === sp.produto) ? sp.produto : undefined,
          immediate,
          quote: sp.orcamento === "1" && !immediate,
          paymentTerms: template?.defaultPaymentTerms ?? "",
        }}
      />
    </div>
  );
}
