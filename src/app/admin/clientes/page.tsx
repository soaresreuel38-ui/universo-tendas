import type { Metadata } from "next";
import { DataTable, LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; inativos?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const digits = q.replace(/\D/g, "");
  const customers = await prisma.customer.findMany({
    where: {
      active: sp.inativos ? false : true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }, { document: { contains: digits } }] : []),
              { phone: { contains: q } },
              { document: { contains: q } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { rentals: true, sales: true } } },
    orderBy: { name: "asc" },
    take: 300,
  });
  return (
    <div>
      <PageHeader title="Clientes" actions={<LinkButton href="/admin/clientes/novo" variant="primary" icon="plus">Novo cliente</LinkButton>} />
      <form className="mb-3 flex gap-2" role="search">
        <input name="q" defaultValue={q} type="search" placeholder="Nome, telefone, CPF/CNPJ ou e-mail" className="h-10 flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm" />
        <button className="h-10 rounded-lg bg-graphite px-4 text-sm font-medium text-white hover:bg-black">Buscar</button>
      </form>
      <Section padded={false}>
        <DataTable
          rows={customers}
          rowKey={(c) => c.id}
          rowHref={(c) => `/admin/clientes/${c.id}`}
          empty="Nenhum cliente encontrado."
          columns={[
            { header: "Nome", mobile: "title", cell: (c) => c.name },
            { header: "Telefone", cell: (c) => c.phone ?? c.whatsapp ?? "—" },
            { header: "CPF/CNPJ", mobile: "hide", cell: (c) => c.document ?? "—" },
            { header: "Locações", align: "right", cell: (c) => c._count.rentals },
            { header: "Compras", align: "right", cell: (c) => c._count.sales },
          ]}
        />
      </Section>
    </div>
  );
}
