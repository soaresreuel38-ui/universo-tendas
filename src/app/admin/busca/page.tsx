import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductThumb } from "@/components/products/ProductThumb";
import { RentalStatusBadge } from "@/components/rentals/RentalStatusBadge";
import { EmptyState, PageHeader, Section } from "@/components/ui/primitives";
import { fmtDateTime, money, seq } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { reservedByProduct } from "@/server/availability";

export const metadata: Metadata = { title: "Busca" };

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title} padded={false}>
      <ul className="divide-y divide-zinc-100">{children}</ul>
    </Section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q: raw } = await searchParams;
  const q = raw?.trim().slice(0, 80) ?? "";
  const digits = q.replace(/\D/g, "");
  const num = /^#?\d{1,9}$/.test(q) ? Number(digits) : null;
  const ci = { contains: q, mode: "insensitive" as const };

  const [products, customers, rentals, sales] = q
    ? await Promise.all([
        prisma.product.findMany({ where: { OR: [{ name: ci }, { sku: ci }, { category: ci }] }, orderBy: [{ active: "desc" }, { name: "asc" }], take: 20 }),
        prisma.customer.findMany({
          where: {
            OR: [
              { name: ci },
              { email: ci },
              { phone: { contains: q } },
              { whatsapp: { contains: q } },
              { document: { contains: q } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }, { document: { contains: digits } }] : []),
            ],
          },
          take: 20,
          orderBy: { name: "asc" },
        }),
        prisma.rental.findMany({
          where: {
            OR: [
              { eventName: ci },
              { eventAddress: ci },
              { customer: { name: ci } },
              { customer: { phone: { contains: q } } },
              ...(digits.length >= 4 ? [{ customer: { phone: { contains: digits } } }] : []),
              ...(num ? [{ number: num }] : []),
            ],
          },
          include: { customer: { select: { name: true } } },
          orderBy: { departureAt: "desc" },
          take: 20,
        }),
        num ? prisma.sale.findMany({ where: { number: num }, include: { customer: { select: { name: true } } } }) : Promise.resolve([]),
      ])
    : [[], [], [], []];
  const reserved = await reservedByProduct(prisma, products.map((p) => p.id));
  const total = products.length + customers.length + rentals.length + sales.length;

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title="Busca" description="Produto, código, cliente, telefone, número da locação ou evento." />
      <form role="search" className="flex gap-2">
        <input name="q" defaultValue={q} type="search" autoFocus placeholder="O que você procura?" className="h-12 flex-1 rounded-md border border-zinc-300 bg-white px-3" />
        <button className="h-12 rounded-md bg-ink px-5 text-sm font-medium text-white">Buscar</button>
      </form>
      {q && total === 0 ? <Section><EmptyState>Nada encontrado para “{q}”.</EmptyState></Section> : null}
      {products.length ? (
        <Group title={`Produtos (${products.length})`}>
          {products.map((p) => {
            const free = Math.max(0, p.qtyAvailable - (reserved.get(p.id) ?? 0));
            return (
              <li key={p.id}>
                <Link href={`/admin/produtos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
                  <ProductThumb photoId={p.photoId} name={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.name}{!p.active ? " (desativado)" : ""}</span>
                    <span className="block font-mono text-xs text-zinc-500">{p.sku} · {p.category}</span>
                  </span>
                  <span className="text-right text-sm">
                    <span className={`block font-semibold tabular ${free > 0 ? "text-emerald-700" : "text-red-700"}`}>{free} disponível</span>
                    <span className="block text-xs text-zinc-500">{p.qtyRented} alugado · {p.qtyMaintenance} manut.</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </Group>
      ) : null}
      {rentals.length ? (
        <Group title={`Locações (${rentals.length})`}>
          {rentals.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/locacoes/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50">
                <span className="min-w-0">
                  <span className="block font-medium"><span className="font-mono text-xs text-zinc-500">#{seq(r.number)}</span> {r.eventName}</span>
                  <span className="block text-sm text-zinc-600">{r.customer.name} · {fmtDateTime(r.departureAt)}</span>
                </span>
                <RentalStatusBadge rental={r} />
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
      {customers.length ? (
        <Group title={`Clientes (${customers.length})`}>
          {customers.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clientes/${c.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                <span className="block font-medium">{c.name}</span>
                <span className="block text-sm text-zinc-600">{[c.phone, c.whatsapp, c.document].filter(Boolean).join(" · ")}</span>
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
      {sales.length ? (
        <Group title="Vendas">
          {sales.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/vendas/${s.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                Venda #{seq(s.number)} — {s.customer?.name ?? s.customerName ?? "Avulsa"} · {money(s.totalCents)}
              </Link>
            </li>
          ))}
        </Group>
      ) : null}
    </div>
  );
}
