import type { Metadata } from "next";
import { PageHeader, Section } from "@/components/ui/primitives";
import { toLocalInput } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { stockProductOptions } from "@/server/options";
import { stockEntryAction } from "../actions";
import { EntryForm } from "../StockForms";

export const metadata: Metadata = { title: "Entrada de estoque" };

export default async function EntryPage({ searchParams }: { searchParams: Promise<{ produto?: string }> }) {
  const user = await requirePermission("stock.entry");
  const { produto } = await searchParams;
  const products = await stockProductOptions();
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="+ Entrada de estoque"
        description={`Compra, devolução ou ajuste. Responsável: ${user.name}. O estoque é atualizado na hora e a entrada fica no histórico.`}
        back={{ href: "/admin/produtos", label: "Estoque" }}
      />
      <Section>
        {products.length === 0 ? (
          <p className="text-sm text-faint">Cadastre um produto antes de registrar entradas.</p>
        ) : (
          <EntryForm action={stockEntryAction} products={products} defaultProduct={produto} now={toLocalInput(new Date())} />
        )}
      </Section>
    </div>
  );
}
