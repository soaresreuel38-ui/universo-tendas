import { beforeEach, describe, expect, it } from "vitest";
import { adjustInventory, closeMaintenance, stockEntry, stockExit } from "@/server/stock";
import { createRental } from "@/server/rentals";
import { at, db, makeCustomer, makeProduct, makeUsers, product, resetDb } from "./helpers";

let users: Awaited<ReturnType<typeof makeUsers>>;

beforeEach(async () => {
  await resetDb();
  users = await makeUsers();
});

describe("entrada de estoque", () => {
  it("soma ao disponível e registra histórico com usuário e motivo", async () => {
    const p = await makeProduct(users.admin, { initialQty: 20 });
    await stockEntry(db, users.employee, { productId: p.id, quantity: 5, reason: "COMPRA", notes: "NF 123" });
    const after = await product(p.id);
    expect(after.qtyAvailable).toBe(25);
    const movements = await db.stockMovement.findMany({ where: { productId: p.id }, orderBy: { createdAt: "asc" } });
    expect(movements).toHaveLength(2);
    expect(movements[1]).toMatchObject({ type: "ENTRADA", delta: 5, quantity: 5, reason: "Compra", userId: users.employee.id, availableAfter: 25, totalAfter: 25 });
  });

  it("rejeita quantidade zero ou negativa", async () => {
    const p = await makeProduct(users.admin);
    await expect(stockEntry(db, users.admin, { productId: p.id, quantity: 0, reason: "COMPRA" })).rejects.toThrow(/maior que zero/);
    await expect(stockEntry(db, users.admin, { productId: p.id, quantity: -3, reason: "COMPRA" })).rejects.toThrow(/maior que zero/);
    expect((await product(p.id)).qtyAvailable).toBe(20);
  });

  it("em produto numerado, cria as unidades com códigos sequenciais", async () => {
    const p = await makeProduct(users.admin, { trackingMode: "UNIT", initialQty: 3 });
    await stockEntry(db, users.admin, { productId: p.id, quantity: 2, reason: "COMPRA" });
    const units = await db.productUnit.findMany({ where: { productId: p.id }, orderBy: { code: "asc" } });
    expect(units.map((u) => u.code)).toEqual(["001", "002", "003", "004", "005"]);
    expect((await product(p.id)).qtyAvailable).toBe(5);
  });
});

describe("saída de estoque e prevenção de saldo negativo", () => {
  it("manutenção tira do disponível e retorno de manutenção devolve", async () => {
    const p = await makeProduct(users.admin, { initialQty: 20 });
    await stockExit(db, users.employee, { productId: p.id, quantity: 2, kind: "MANUTENCAO", reason: "Lona rasgada" });
    let after = await product(p.id);
    expect(after).toMatchObject({ qtyAvailable: 18, qtyMaintenance: 2 });
    const m = await db.maintenance.findFirstOrThrow({ where: { productId: p.id } });
    await closeMaintenance(db, users.employee, { maintenanceId: m.id, outcome: "CONCLUIDA" });
    after = await product(p.id);
    expect(after).toMatchObject({ qtyAvailable: 20, qtyMaintenance: 0 });
    await expect(closeMaintenance(db, users.employee, { maintenanceId: m.id, outcome: "CONCLUIDA" })).rejects.toThrow(/já foi encerrada/);
  });

  it("perda reduz o total definitivamente", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    await stockExit(db, users.employee, { productId: p.id, quantity: 1, kind: "PERDA", reason: "Vendaval" });
    const after = await product(p.id);
    expect(after).toMatchObject({ qtyAvailable: 9, qtyLost: 1 });
  });

  it("bloqueia saída maior que o disponível", async () => {
    const p = await makeProduct(users.admin, { initialQty: 3 });
    await expect(stockExit(db, users.employee, { productId: p.id, quantity: 4, kind: "PERDA", reason: "x" })).rejects.toThrow(/Estoque insuficiente/);
    expect((await product(p.id)).qtyAvailable).toBe(3);
  });

  it("bloqueia saída que deixaria uma reserva futura sem estoque", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const c = await makeCustomer();
    await createRental(db, users.employee, {
      customerId: c.id, eventName: "Casamento", departureAt: at(5), expectedReturnAt: at(6),
      items: [{ productId: p.id, quantity: 8, unitPriceCents: 0 }], status: "RESERVADA",
    });
    await expect(stockExit(db, users.employee, { productId: p.id, quantity: 3, kind: "MANUTENCAO", reason: "x" })).rejects.toThrow(/Disponível para esta operação: 2/);
    await stockExit(db, users.employee, { productId: p.id, quantity: 2, kind: "MANUTENCAO", reason: "x" });
  });

  it("o banco recusa saldo negativo mesmo se a aplicação falhar (CHECK)", async () => {
    const p = await makeProduct(users.admin, { initialQty: 1 });
    await expect(db.product.update({ where: { id: p.id }, data: { qtyAvailable: { decrement: 2 } } })).rejects.toThrow(/check constraint/i);
  });
});

describe("ajuste de inventário", () => {
  it("somente administrador ajusta, e o histórico registra a diferença", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    await expect(adjustInventory(db, users.employee, { productId: p.id, countedQty: 8, reason: "Contagem" })).rejects.toThrow(/permissão/);
    await adjustInventory(db, users.admin, { productId: p.id, countedQty: 8, reason: "Contagem mensal" });
    expect((await product(p.id)).qtyAvailable).toBe(8);
    const adj = await db.stockMovement.findFirstOrThrow({ where: { productId: p.id, type: "AJUSTE" } });
    expect(adj).toMatchObject({ delta: -2, quantity: 2 });
  });
});
