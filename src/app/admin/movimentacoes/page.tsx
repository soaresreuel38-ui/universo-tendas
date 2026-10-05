import type { Metadata } from "next";
import type { MovementType, Prisma } from "@prisma/client";
import { MovementTable, movementInclude } from "@/components/stock/MovementTable";
import { LinkButton, PageHeader, Section } from "@/components/ui/primitives";
import { MOVEMENT_LABEL } from "@/lib/domain";
import { DATE_KEY_RE, addDays, startOfDay } from "@/lib/time";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "Movimentações" };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<{ produto?: string; tipo?: string; de?: string; ate?: string; usuario?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const where: Prisma.StockMovementWhereInput = {
    ...(sp.produto ? { productId: sp.produto } : {}),
    ...(sp.tipo && sp.tipo in MOVEMENT_LABEL ? { type: sp.tipo as MovementType } : {}),
    ...(sp.usuario ? { userId: sp.usuario } : {}),
    occurredAt: {
      ...(sp.de && DATE_KEY_RE.test(sp.de) ? { gte: startOfDay(sp.de) } : {}),
      ...(sp.ate && DATE_KEY_RE.test(sp.ate) ? { lt: startOfDay(addDays(sp.ate, 1)) } : {}),
    },
  };
  const [rows, products, users] = await Promise.all([
    prisma.stockMovement.findMany({ where, include: movementInclude, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 300 }),
    prisma.product.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const select = "h-10 rounded-lg border border-line-strong bg-white px-2 text-sm";
  return (
    <div>
      <PageHeader
        title="Movimentações do estoque"
        description="Histórico completo: data, produto, quantidade, operação, usuário, motivo e observação. Nada é apagado."
        actions={<LinkButton href="/admin/estoque/entrada" icon="arrowIn">Nova entrada</LinkButton>}
      />
      <form className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <select name="produto" defaultValue={sp.produto ?? ""} className={`${select} col-span-2`}>
          <option value="">Todos os produtos</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="tipo" defaultValue={sp.tipo ?? ""} className={select}>
          <option value="">Todas as operações</option>
          {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="usuario" defaultValue={sp.usuario ?? ""} className={select}>
          <option value="">Todos os usuários</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <input type="date" name="de" defaultValue={sp.de} className={select} aria-label="De" />
        <input type="date" name="ate" defaultValue={sp.ate} className={select} aria-label="Até" />
        <button className="col-span-2 h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft md:col-span-1">Filtrar</button>
      </form>
      <Section padded={false}>
        <MovementTable rows={rows} />
      </Section>
      {rows.length === 300 ? <p className="mt-2 text-xs text-faint">Mostrando as 300 mais recentes. Use os filtros ou exporte em Relatórios.</p> : null}
    </div>
  );
}
