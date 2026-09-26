import { NextResponse, type NextRequest } from "next/server";
import { seq } from "@/lib/format";
import { RENTAL_STATUS_LABEL, CONTRACT_STATUS_LABEL, effectiveStatus, effectiveContractStatus } from "@/lib/domain";
import { getCurrentUser } from "@/server/auth/session";
import { globalSearch } from "@/server/search";

export type SearchHit = { group: string; href: string; title: string; sub: string; photoId?: string | null; badge?: string };

/** Resultados instantâneos para a paleta de busca (atalho "/"). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const r = await globalSearch(request.nextUrl.searchParams.get("q") ?? "", 6);
  const hits: SearchHit[] = [
    ...r.customers.map((c) => ({ group: "Clientes", href: `/admin/clientes/${c.id}`, title: c.name, sub: [c.phone ?? c.whatsapp, c.document].filter(Boolean).join(" · ") })),
    ...r.products.map((p) => ({ group: "Produtos", href: `/admin/produtos/${p.id}`, title: p.name, sub: `${p.sku} · ${p.category}`, photoId: p.photoId })),
    ...r.rentals.map((x) => ({
      group: "Locações",
      href: `/admin/locacoes/${x.id}`,
      title: `#${seq(x.number)} · ${x.eventName}`,
      sub: x.customer.name,
      badge: RENTAL_STATUS_LABEL[effectiveStatus(x)],
    })),
    ...r.contracts.map((c) => ({
      group: "Contratos",
      href: `/admin/contratos/${c.id}`,
      title: `Contrato #${seq(c.number)}`,
      sub: [c.customer.name, c.rental?.eventName].filter(Boolean).join(" · "),
      badge: CONTRACT_STATUS_LABEL[effectiveContractStatus(c)],
    })),
    ...r.sales.map((s) => ({ group: "Vendas", href: `/admin/vendas/${s.id}`, title: `Venda #${seq(s.number)}`, sub: s.customer?.name ?? s.customerName ?? "Venda avulsa" })),
  ];
  return NextResponse.json({ q: r.q, hits }, { headers: { "Cache-Control": "no-store" } });
}
