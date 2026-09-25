import type { PrismaClient } from "@prisma/client";
import { assertCan, DomainError, type Actor } from "./errors";

export type CustomerInput = {
  name: string;
  document?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

export async function saveCustomer(db: PrismaClient, actor: Actor, input: CustomerInput, id?: string) {
  assertCan(actor, "customer.manage");
  if (!input.name.trim()) throw new DomainError("Informe o nome do cliente.");
  if (id) return db.customer.update({ where: { id }, data: input });
  return db.customer.create({ data: input });
}

/** Clientes com locações ou vendas são desativados (o histórico é mantido). */
export async function deleteCustomer(db: PrismaClient, actor: Actor, id: string) {
  assertCan(actor, "product.manage");
  const c = await db.customer.findUnique({ where: { id }, include: { _count: { select: { rentals: true, sales: true } } } });
  if (!c) throw new DomainError("Cliente não encontrado.");
  if (c._count.rentals + c._count.sales > 0) {
    await db.customer.update({ where: { id }, data: { active: false } });
    return "deactivated" as const;
  }
  await db.customer.delete({ where: { id } });
  return "deleted" as const;
}
