import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { toLocalInput } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { customerOptions, stockProductOptions } from "@/server/options";
import { createSaleAction } from "../actions";
import { SaleForm } from "../SaleForm";

export const metadata: Metadata = { title: "Nova venda" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ produto?: string }> }) {
  await requirePermission("sale.create");
  const { produto } = await searchParams;
  const [customers, all] = await Promise.all([customerOptions(), stockProductOptions({ withRemovable: true })]);
  const products = all
    .filter((p) => p.kind !== "RENTAL")
    .map((p) => ({ value: p.value, label: p.label, sub: p.sub, right: `${p.free} disp.`, unit: p.unit, free: p.free, salePriceCents: p.salePriceCents }));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nova venda" description="Produto vendido sai definitivamente do estoque." back={{ href: "/admin/vendas", label: "Vendas" }} />
      {products.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          Nenhum produto cadastrado para venda. Cadastre produtos com tipo “Venda” ou “Locação e venda”.
        </p>
      ) : (
        <SaleForm action={createSaleAction} customers={customers} products={products} now={toLocalInput(new Date())} defaultProduct={produto} />
      )}
    </div>
  );
}
