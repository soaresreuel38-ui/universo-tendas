import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/primitives";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createProductAction } from "../actions";
import { ProductForm } from "../ProductForm";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  await requirePermission("product.manage");
  const categories = (await prisma.product.findMany({ distinct: ["category"], select: { category: true } })).map((c) => c.category);
  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo produto" back={{ href: "/admin/produtos", label: "Estoque" }} />
      <Section>
        <ProductForm
          action={createProductAction}
          categories={categories}
          initial={
            settings?.defaultMinStock
              ? { name: "", sku: "", category: "", kind: "RENTAL", trackingMode: "QUANTITY", description: null, unit: "un", rentalPriceCents: null, salePriceCents: null, minStock: settings.defaultMinStock, photoId: null, notes: null, active: true }
              : undefined
          }
        />
      </Section>
    </div>
  );
}
