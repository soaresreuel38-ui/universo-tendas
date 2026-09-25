import { beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/domain";
import { createProduct, deleteOrDeactivateProduct, updateProduct } from "@/server/products";
import { createUser, updateUser } from "@/server/users";
import { closeMaintenance, stockEntry, stockExit } from "@/server/stock";
import { db, makeProduct, makeUsers, resetDb } from "./helpers";

let users: Awaited<ReturnType<typeof makeUsers>>;

beforeEach(async () => {
  await resetDb();
  users = await makeUsers();
});

describe("matriz de permissões", () => {
  it("funcionário registra entrada, saída, retorno e consulta", () => {
    for (const p of ["stock.entry", "stock.exit", "rental.manage", "rental.checkin", "sale.create"] as const) {
      expect(can("EMPLOYEE", p)).toBe(true);
    }
  });
  it("funcionário não altera configurações críticas", () => {
    for (const p of ["product.manage", "stock.adjust", "user.manage", "settings.manage", "report.view", "sale.cancel", "maintenance.discard", "pending.lost"] as const) {
      expect(can("EMPLOYEE", p)).toBe(false);
      expect(can("ADMIN", p)).toBe(true);
    }
  });
});

describe("permissões aplicadas no servidor", () => {
  const input = { name: "Mesa", sku: "MESA-1", category: "Mesas", kind: "RENTAL" as const, trackingMode: "QUANTITY" as const, unit: "un", minStock: 0, active: true };

  it("funcionário não cadastra, edita nem exclui produtos", async () => {
    await expect(createProduct(db, users.employee, input)).rejects.toThrow(/permissão/);
    const p = await createProduct(db, users.admin, { ...input, initialQty: 5 });
    await expect(updateProduct(db, users.employee, p.id, { ...input, name: "X" })).rejects.toThrow(/permissão/);
    await expect(deleteOrDeactivateProduct(db, users.employee, p.id)).rejects.toThrow(/permissão/);
  });

  it("funcionário não cria usuários", async () => {
    await expect(createUser(db, users.employee, { name: "X", email: "x@x.com", password: "senha-bem-longa", role: "ADMIN" })).rejects.toThrow(/permissão/);
  });

  it("funcionário não descarta item em manutenção, mas pode concluir o conserto", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    await stockExit(db, users.employee, { productId: p.id, quantity: 2, kind: "MANUTENCAO", reason: "x" });
    const m = await db.maintenance.findFirstOrThrow();
    await expect(closeMaintenance(db, users.employee, { maintenanceId: m.id, outcome: "DESCARTADA" })).rejects.toThrow(/permissão/);
    await closeMaintenance(db, users.employee, { maintenanceId: m.id, outcome: "CONCLUIDA" });
  });

  it("produto com histórico é desativado, não apagado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    await stockEntry(db, users.employee, { productId: p.id, quantity: 1, reason: "COMPRA" });
    expect(await deleteOrDeactivateProduct(db, users.admin, p.id)).toBe("deactivated");
    expect(await db.stockMovement.count({ where: { productId: p.id } })).toBe(2);
  });

  it("não remove o último administrador e troca de senha derruba sessões", async () => {
    await expect(updateUser(db, users.admin, users.admin.id, { name: "A", role: "EMPLOYEE", active: true })).rejects.toThrow(/próprio acesso/);
    const before = await db.user.findUniqueOrThrow({ where: { id: users.employee.id } });
    await updateUser(db, users.admin, users.employee.id, { name: "F", role: "EMPLOYEE", active: true, password: "nova-senha-segura" });
    const after = await db.user.findUniqueOrThrow({ where: { id: users.employee.id } });
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
  });
});
