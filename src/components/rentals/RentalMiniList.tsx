import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
import { fmtDateTime, seq } from "@/lib/format";
import type { RentalListRow } from "@/server/queries";
import { RentalStatusBadge } from "./RentalStatusBadge";

/** Lista compacta de locações para o painel. */
export function RentalMiniList({
  rentals,
  when,
  empty,
  action,
}: {
  rentals: RentalListRow[];
  when: "departure" | "return" | "event" | "setup" | "teardown";
  empty: string;
  action?: { label: string; href: (id: string) => string };
}) {
  if (rentals.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="divide-y divide-zinc-100">
      {rentals.map((r) => {
        const date =
          when === "departure"
            ? r.departureAt
            : when === "return"
              ? r.expectedReturnAt
              : when === "setup"
                ? (r.setupAt ?? r.departureAt)
                : when === "teardown"
                  ? (r.teardownAt ?? r.expectedReturnAt)
                  : (r.eventAt ?? r.departureAt);
        const items = r.items.map((i) => `${i.quantity} ${i.product.name}`).join(", ");
        return (
          <li key={r.id} className="flex items-start gap-3 px-4 py-3">
            <Link href={`/admin/locacoes/${r.id}`} className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-mono text-xs text-zinc-500">#{seq(r.number)}</span>
                <span className="font-medium text-zinc-900">{r.eventName}</span>
                <RentalStatusBadge rental={r} />
              </p>
              <p className="mt-0.5 truncate text-sm text-zinc-600">
                {r.customer.name} · {fmtDateTime(date)}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{items}</p>
            </Link>
            {action ? (
              <Link
                href={action.href(r.id)}
                className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                {action.label}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
