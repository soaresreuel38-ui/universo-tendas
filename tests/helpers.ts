import { PrismaClient } from "@prisma/client";
import type { Actor } from "@/server/errors";
import { addDays, todayKey, TZ, zonedToUtc } from "@/lib/time";
import { createProduct, type ProductInput } from "@/server/products";

export const db = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://ut:ut@localhost:5432/ut_test" } },
});

export async function resetDb() {
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function makeUsers() {
  const admin = await db.user.create({ data: { name: "Admin Teste", email: "admin@teste.local", passwordHash: "x", role: "ADMIN" } });
  const employee = await db.user.create({ data: { name: "Func Teste", email: "func@teste.local", passwordHash: "x", role: "EMPLOYEE" } });
  const asActor = (u: typeof admin): Actor => ({ id: u.id, role: u.role, name: u.name });
  return { admin: asActor(admin), employee: asActor(employee) };
}

export async function makeCustomer(name = "Cliente Teste") {
  return db.customer.create({ data: { name, phone: "66999990000" } });
}

export async function makeProduct(actor: Actor, overrides: Partial<ProductInput> & { initialQty?: number } = {}) {
  return createProduct(db, actor, {
    name: "Tenda 5x5",
    sku: `SKU-${Math.random().toString(36).slice(2, 8)}`,
    category: "Tendas",
    kind: "BOTH",
    trackingMode: "QUANTITY",
    unit: "un",
    minStock: 0,
    active: true,
    initialQty: 20,
    ...overrides,
  });
}

/** Data relativa a hoje, no horário de Sinop: at(1, 8) = amanhã às 08:00. */
export const at = (dayOffset: number, hour = 8) =>
  zonedToUtc(addDays(todayKey(), dayOffset), `${String(hour).padStart(2, "0")}:00`, TZ);

export async function product(id: string) {
  return db.product.findUniqueOrThrow({ where: { id } });
}
