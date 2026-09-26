import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/forms";
import { Badge, DataTable, DefinitionList, Field, Input, Notice, PageHeader, Section } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LABEL, can } from "@/lib/domain";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { cancelSaleAction } from "../actions";

export const metadata: Metadata = { title: "Venda" };

export default async function SalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { salvo } = await searchParams;
  const s = await prisma.sale.findUnique({
    where: { id },
    include: { customer: true, user: { select: { name: true } }, items: { include: { product: true } }, payments: true },
  });
  if (!s) notFound();
  const gross = s.items.reduce((t, i) => t + i.quantity * i.unitPriceCents, 0);
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        back={{ href: "/admin/vendas", label: "Vendas" }}
        title={
          <span className="flex items-center gap-2">
            Venda #{seq(s.number)} {s.status === "CANCELADA" ? <Badge tone="muted">Cancelada</Badge> : <Badge tone="ok">Concluída</Badge>}
          </span>
        }
      />
      {salvo ? <Notice tone="ok">Venda registrada. Os produtos foram retirados do estoque.</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <a href={`/api/pdf/venda/${s.id}`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-white px-4 text-sm font-medium">
          Comprovante em PDF
        </a>
      </div>
      <Section title="Produtos" padded={false}>
        <DataTable
          rows={s.items}
          rowKey={(i) => i.id}
          columns={[
            { header: "Produto", mobile: "title", cell: (i) => <Link href={`/admin/produtos/${i.productId}`} className="hover:underline">{i.product.name}</Link> },
            { header: "Qtd.", align: "right", cell: (i) => `${i.quantity} ${i.product.unit}` },
            { header: "Valor unit.", align: "right", cell: (i) => money(i.unitPriceCents) },
            { header: "Subtotal", align: "right", cell: (i) => money(i.quantity * i.unitPriceCents) },
          ]}
        />
        <div className="border-t border-line px-4 py-3 text-right text-sm">
          {s.discountCents ? <p className="text-faint">Subtotal {money(gross)} · Desconto −{money(s.discountCents)}</p> : null}
          <p className="text-lg font-semibold">Total {money(s.totalCents)}</p>
        </div>
      </Section>
      <Section title="Dados da venda">
        <DefinitionList
          items={[
            ["Cliente", s.customer ? <Link href={`/admin/clientes/${s.customer.id}`} className="underline">{s.customer.name}</Link> : (s.customerName ?? "Venda avulsa")],
            ["Data", fmtDateTime(s.soldAt)],
            ["Responsável", s.user.name],
            ["Registrada em", fmtDateTime(s.createdAt)],
            ["Pagamento", s.payments.length ? s.payments.map((p) => `${PAYMENT_METHOD_LABEL[p.method]} ${money(p.amountCents)}`).join(" · ") : "Não registrado"],
            ["Observações", s.notes],
            ...(s.canceledAt ? ([["Cancelada em", fmtDateTime(s.canceledAt)]] as Array<[string, string]>) : []),
          ]}
        />
      </Section>
      {s.status === "CONCLUIDA" && can(user.role, "sale.cancel") ? (
        <Section title="Cancelar venda">
          <ActionForm action={cancelSaleAction} submitLabel="Cancelar venda e devolver ao estoque" submitVariant="danger" confirm="Cancelar esta venda?">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Motivo" required>
              <Input name="reason" required maxLength={300} />
            </Field>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
