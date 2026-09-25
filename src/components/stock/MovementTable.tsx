import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { DataTable } from "@/components/ui/primitives";
import { MOVEMENT_LABEL } from "@/lib/domain";
import { fmtDateTime, seq } from "@/lib/format";

export const movementInclude = {
  product: { select: { id: true, name: true, unit: true } },
  user: { select: { name: true } },
  rental: { select: { id: true, number: true } },
  sale: { select: { id: true, number: true } },
} satisfies Prisma.StockMovementInclude;

export type MovementRow = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;

function signed(m: MovementRow) {
  if (m.delta > 0) return <span className="tabular font-semibold text-emerald-700">+{m.delta}</span>;
  if (m.delta < 0) return <span className="tabular font-semibold text-red-700">{m.delta}</span>;
  return <span className="tabular text-zinc-600">{m.quantity}</span>;
}

export function MovementTable({ rows, showProduct = true }: { rows: MovementRow[]; showProduct?: boolean }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(m) => m.id}
      empty="Nenhuma movimentação registrada."
      columns={[
        {
          header: "Data",
          mobile: "title",
          cell: (m) => (
            <span className="whitespace-nowrap">
              {fmtDateTime(m.occurredAt)}
              <span className="ml-2 font-normal text-zinc-500 md:hidden">{MOVEMENT_LABEL[m.type]}</span>
            </span>
          ),
        },
        ...(showProduct
          ? [{ header: "Produto", cell: (m: MovementRow) => <Link href={`/admin/produtos/${m.product.id}`} className="hover:underline">{m.product.name}</Link> }]
          : []),
        { header: "Operação", mobile: "hide" as const, cell: (m: MovementRow) => MOVEMENT_LABEL[m.type] },
        { header: "Qtd. / depósito", align: "right" as const, cell: signed },
        { header: "Saldo total", align: "right" as const, mobile: "hide" as const, cell: (m: MovementRow) => <span className="tabular text-zinc-600">{m.totalAfter}</span> },
        { header: "Usuário", cell: (m: MovementRow) => m.user.name },
        {
          header: "Motivo / referência",
          cell: (m: MovementRow) => (
            <span className="text-zinc-700">
              {m.rental ? (
                <Link href={`/admin/locacoes/${m.rental.id}`} className="underline">Locação #{seq(m.rental.number)}</Link>
              ) : m.sale ? (
                <Link href={`/admin/vendas/${m.sale.id}`} className="underline">Venda #{seq(m.sale.number)}</Link>
              ) : (
                m.reason ?? "—"
              )}
            </span>
          ),
        },
        { header: "Observação", mobile: "hide" as const, cell: (m: MovementRow) => <span className="text-zinc-500">{m.notes ?? ""}</span> },
      ]}
    />
  );
}
