import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Section } from "@/components/ui/primitives";
import { requirePermission } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { updateProductAction } from "../../actions";
import { ProductForm } from "../../ProductForm";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("product.manage");
  const { id } = await params;
  const p = await prisma.product.findUnique({ where: { id }, include: { _count: { select: { units: true } } } });
  if (!p) notFound();
  const categories = (await prisma.product.findMany({ distinct: ["category"], select: { category: true } })).map((c) => c.category);
  const hasStock = p.qtyAvailable + p.qtyRented + p.qtyMaintenance + p.qtyPending > 0 || p._count.units > 0;
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Editar: ${p.name}`} back={{ href: `/admin/produtos/${p.id}`, label: p.name }} description="Quantidades não são editadas aqui: use Entrada, Saída ou Ajuste para manter o histórico." />
      <Section>
        <ProductForm action={updateProductAction} categories={categories} initial={p} lockTracking={hasStock} />
      </Section>
    </div>
  );
}
