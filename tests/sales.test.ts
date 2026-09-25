import { beforeEach, describe, expect, it } from "vitest";
import { cancelSale, createSale } from "@/server/sales";
import { createRental } from "@/server/rentals";
import { at, db, makeCustomer, makeProduct, makeUsers, product, resetDb } from "./helpers";

let users: Awaited<ReturnType<typeof makeUsers>>;

beforeEach(async () => {
  await resetDb();
  users = await makeUsers();
});

describe("vendas", () => {
  it("CADASTRAR → VENDA → produto sai definitivamente do estoque", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const c = await makeCustomer();
    const sale = await createSale(db, users.employee, { customerId: c.id, items: [{ productId: p.id, quantity: 2, unitPriceCents: 250000 }] });
    expect(sale.totalCents).toBe(500000);
    const after = await product(p.id);
    expect(after).toMatchObject({ qtyAvailable: 8, qtySold: 2, qtyRented: 0 });
    expect(after.qtyAvailable + after.qtyRented + after.qtyMaintenance + after.qtyPending).toBe(8);
    const mv = await db.stockMovement.findFirstOrThrow({ where: { saleId: sale.id } });
    expect(mv).toMatchObject({ type: "VENDA", delta: -2, totalAfter: 8, userId: users.employee.id });
  });

  it("ESTOQUE INSUFICIENTE → bloqueia a venda e nada é gravado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 1 });
    await expect(createSale(db, users.employee, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] })).rejects.toThrow(/Estoque insuficiente/);
    expect(await db.sale.count()).toBe(0);
    expect((await product(p.id)).qtyAvailable).toBe(1);
  });

  it("não vende o que já está reservado para locação futura", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const c = await makeCustomer();
    await createRental(db, users.employee, {
      customerId: c.id, eventName: "Feira", departureAt: at(4), expectedReturnAt: at(5),
      items: [{ productId: p.id, quantity: 9, unitPriceCents: 0 }], status: "CONFIRMADA",
    });
    await expect(createSale(db, users.employee, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] })).rejects.toThrow(/Disponível para esta operação: 1/);
  });

  it("produto só de locação não pode ser vendido", async () => {
    const p = await makeProduct(users.admin, { kind: "RENTAL" });
    await expect(createSale(db, users.employee, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }] })).rejects.toThrow(/somente para locação/);
  });

  it("cancelamento (administrador) devolve ao estoque; funcionário não pode cancelar", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5, trackingMode: "UNIT" });
    const sale = await createSale(db, users.employee, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] });
    expect(await db.productUnit.count({ where: { productId: p.id, status: "SOLD" } })).toBe(2);
    await expect(cancelSale(db, users.employee, sale.id, "erro")).rejects.toThrow(/permissão/);
    await cancelSale(db, users.admin, sale.id, "Cliente desistiu");
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 5, qtySold: 0 });
    expect(await db.productUnit.count({ where: { productId: p.id, status: "AVAILABLE" } })).toBe(5);
    await expect(cancelSale(db, users.admin, sale.id, "de novo")).rejects.toThrow(/já foi cancelada/);
  });
});
