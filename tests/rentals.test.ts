import { beforeEach, describe, expect, it } from "vitest";
import { availabilityForPeriod } from "@/server/availability";
import { changeRentalStatus, checkInRental, createRental, departRental, updateRental } from "@/server/rentals";
import { resolvePending } from "@/server/stock";
import { at, db, makeCustomer, makeProduct, makeUsers, product, resetDb } from "./helpers";

let users: Awaited<ReturnType<typeof makeUsers>>;
let customerId: string;

beforeEach(async () => {
  await resetDb();
  users = await makeUsers();
  customerId = (await makeCustomer("João da Silva")).id;
});

const rentalInput = (productId: string, quantity: number, from: Date, to: Date) => ({
  customerId,
  eventName: "Casamento",
  departureAt: from,
  expectedReturnAt: to,
  items: [{ productId, quantity, unitPriceCents: 15000 }],
});

describe("fluxo completo de locação", () => {
  it("CADASTRAR → RESERVAR → SAÍDA → ALUGADO → RETORNO → CONFERIR → ESTOQUE", async () => {
    const p = await makeProduct(users.admin, { initialQty: 20 });

    const r = await createRental(db, users.employee, { ...rentalInput(p.id, 4, at(0, 6), at(2)), status: "RESERVADA" });
    expect(r.status).toBe("RESERVADA");
    expect(r.totalCents).toBe(60000);
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 20, qtyRented: 0 }); // reservado, ainda no depósito

    await departRental(db, users.employee, r.id, { pickupBy: "Carlos" });
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 16, qtyRented: 4 });
    const departed = await db.rental.findUniqueOrThrow({ where: { id: r.id } });
    expect(departed.status).toBe("SAIU");
    expect(departed.pickupBy).toBe("Carlos");

    await changeRentalStatus(db, users.employee, r.id, "EM_EVENTO");
    await changeRentalStatus(db, users.employee, r.id, "RETORNADA");

    const item = await db.rentalItem.findFirstOrThrow({ where: { rentalId: r.id } });
    await checkInRental(db, users.employee, r.id, { items: [{ itemId: item.id, good: 4, damaged: 0, missing: 0 }] });
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 20, qtyRented: 0, qtyMaintenance: 0, qtyPending: 0 });
    const checked = await db.rental.findUniqueOrThrow({ where: { id: r.id } });
    expect(checked.status).toBe("CONFERIDA");
    expect(checked.checkedById).toBe(users.employee.id);

    await changeRentalStatus(db, users.employee, r.id, "FINALIZADA");
    const types = (await db.stockMovement.findMany({ where: { productId: p.id }, orderBy: { createdAt: "asc" } })).map((m) => m.type);
    expect(types).toEqual(["ENTRADA", "SAIDA_LOCACAO", "RETORNO_LOCACAO"]);
  });

  it("saída imediata na criação (tipo Locação na tela de saída)", async () => {
    const p = await makeProduct(users.admin, { initialQty: 20 });
    const r = await createRental(db, users.employee, { ...rentalInput(p.id, 4, at(0, 0), at(1)), status: "SAIU" });
    expect(r.status).toBe("SAIU");
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 16, qtyRented: 4 });
  });
});

describe("prevenção de dupla reserva", () => {
  it("20 tendas, 10 alugadas + 8 reservadas no dia → só 2 livres; pedir 5 é bloqueado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 20 });
    const a = await createRental(db, users.employee, { ...rentalInput(p.id, 10, at(0, 0), at(3)), status: "RESERVADA" });
    await departRental(db, users.employee, a.id);
    await createRental(db, users.employee, { ...rentalInput(p.id, 8, at(2), at(3)), status: "CONFIRMADA" });

    const avail = await availabilityForPeriod(db, [p.id], at(2), at(3));
    expect(avail.get(p.id)?.free).toBe(2);

    await expect(
      createRental(db, users.employee, { ...rentalInput(p.id, 5, at(2), at(3)), status: "RESERVADA" }),
    ).rejects.toThrow("Estoque insuficiente para esta data — Tenda 5x5. Disponibilidade atual: 2 unidades.");

    await createRental(db, users.employee, { ...rentalInput(p.id, 2, at(2), at(3)), status: "RESERVADA" });
    await expect(
      createRental(db, users.employee, { ...rentalInput(p.id, 1, at(2), at(3)), status: "RESERVADA" }),
    ).rejects.toThrow(/Disponibilidade atual: 0 unidades/);
  });

  it("períodos que não se sobrepõem usam o mesmo estoque", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    await createRental(db, users.employee, { ...rentalInput(p.id, 5, at(3), at(4)), status: "RESERVADA" });
    await createRental(db, users.employee, { ...rentalInput(p.id, 5, at(5), at(6)), status: "RESERVADA" });
    await expect(
      createRental(db, users.employee, { ...rentalInput(p.id, 1, at(4, 6), at(5, 9)), status: "RESERVADA" }),
    ).rejects.toThrow(/Disponibilidade atual: 0/);
  });

  it("orçamento não reserva estoque, mas é validado ao ser confirmado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const quote = await createRental(db, users.employee, { ...rentalInput(p.id, 5, at(3), at(4)), status: "ORCAMENTO" });
    await createRental(db, users.employee, { ...rentalInput(p.id, 3, at(3), at(4)), status: "RESERVADA" });
    await expect(changeRentalStatus(db, users.employee, quote.id, "RESERVADA")).rejects.toThrow(/Disponibilidade atual: 2/);
  });

  it("editar uma reserva revalida sem contar ela mesma", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const r = await createRental(db, users.employee, { ...rentalInput(p.id, 5, at(3), at(4)), status: "RESERVADA" });
    await updateRental(db, users.employee, r.id, rentalInput(p.id, 5, at(3), at(5)));
    await expect(updateRental(db, users.employee, r.id, rentalInput(p.id, 6, at(3), at(5)))).rejects.toThrow(/Disponibilidade atual: 5/);
  });

  it("produtos em manutenção não entram na disponibilidade", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    await db.product.update({ where: { id: p.id }, data: { qtyAvailable: 3, qtyMaintenance: 2 } });
    await expect(
      createRental(db, users.employee, { ...rentalInput(p.id, 4, at(3), at(4)), status: "RESERVADA" }),
    ).rejects.toThrow(/Disponibilidade atual: 3/);
  });

  it("duas pessoas reservando ao mesmo tempo o último estoque: só uma consegue", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        createRental(db, i % 2 ? users.employee : users.admin, { ...rentalInput(p.id, 4, at(3), at(4)), status: "RESERVADA" }),
      ),
    );
    const ok = attempts.filter((a) => a.status === "fulfilled");
    expect(ok).toHaveLength(2); // 4 + 4 = 8 de 10; a terceira já não cabe
    const reserved = await db.rentalItem.aggregate({ where: { productId: p.id, rental: { status: "RESERVADA" } }, _sum: { quantity: true } });
    expect(reserved._sum.quantity).toBe(8);
  });

  it("saídas simultâneas nunca deixam o estoque negativo", async () => {
    const p = await makeProduct(users.admin, { initialQty: 6 });
    const quotes = await Promise.all(
      Array.from({ length: 4 }, () => createRental(db, users.employee, { ...rentalInput(p.id, 3, at(0, 0), at(2)), status: "ORCAMENTO" })),
    );
    const results = await Promise.allSettled(quotes.map((q) => departRental(db, users.employee, q.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 0, qtyRented: 6 });
  });
});

describe("retorno com diferenças", () => {
  async function outRental(quantity: number, productOverrides = {}) {
    const p = await makeProduct(users.admin, { initialQty: 20, ...productOverrides });
    const r = await createRental(db, users.employee, { ...rentalInput(p.id, quantity, at(0, 0), at(1)), status: "SAIU" });
    const item = await db.rentalItem.findFirstOrThrow({ where: { rentalId: r.id } });
    return { p, r, item };
  }

  it("boas voltam ao disponível, danificadas vão para manutenção e faltantes viram pendência", async () => {
    const { p, r, item } = await outRental(10);
    await checkInRental(db, users.employee, r.id, {
      items: [{ itemId: item.id, good: 8, damaged: 1, missing: 1, note: "1 lona rasgada, 1 não devolvida pelo cliente" }],
    });
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 18, qtyRented: 0, qtyMaintenance: 1, qtyPending: 1 });
    const m = await db.maintenance.findFirstOrThrow({ where: { productId: p.id } });
    expect(m).toMatchObject({ quantity: 1, rentalId: r.id, status: "ABERTA" });
    const saved = await db.rentalItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(saved).toMatchObject({ qtyReturned: 8, qtyDamaged: 1, qtyMissing: 1 });

    await resolvePending(db, users.employee, { rentalItemId: item.id, quantity: 1, outcome: "ENCONTRADO" });
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 19, qtyPending: 0 });
    await expect(resolvePending(db, users.employee, { rentalItemId: item.id, quantity: 1, outcome: "ENCONTRADO" })).rejects.toThrow(/apenas 0/);
  });

  it("exige justificativa quando há diferença", async () => {
    const { r, item } = await outRental(10);
    await expect(
      checkInRental(db, users.employee, r.id, { items: [{ itemId: item.id, good: 9, damaged: 1, missing: 0 }] }),
    ).rejects.toThrow(/Justifique/);
  });

  it("exige que a soma bata com o que saiu", async () => {
    const { r, item } = await outRental(10);
    await expect(
      checkInRental(db, users.employee, r.id, { items: [{ itemId: item.id, good: 9, damaged: 0, missing: 0 }] }),
    ).rejects.toThrow(/precisa ser igual ao enviado \(10\)/);
  });

  it("não confere duas vezes a mesma locação", async () => {
    const { r, item } = await outRental(2);
    await checkInRental(db, users.employee, r.id, { items: [{ itemId: item.id, good: 2, damaged: 0, missing: 0 }] });
    await expect(
      checkInRental(db, users.employee, r.id, { items: [{ itemId: item.id, good: 2, damaged: 0, missing: 0 }] }),
    ).rejects.toThrow(/não pode ser conferida/);
  });

  it("produto numerado: registra quais unidades saíram e o estado de cada uma no retorno", async () => {
    const { p, r, item } = await outRental(3, { trackingMode: "UNIT", initialQty: 5 });
    const links = await db.rentalItemUnit.findMany({ where: { rentalItemId: item.id }, include: { unit: true } });
    expect(links.map((l) => l.unit.code).sort()).toEqual(["001", "002", "003"]);
    expect(await db.productUnit.count({ where: { productId: p.id, status: "RENTED" } })).toBe(3);

    const [u1, u2, u3] = links;
    await checkInRental(db, users.employee, r.id, {
      items: [{ itemId: item.id, good: 0, damaged: 0, missing: 0, note: "Unidade com haste torta", unitStates: { [u1.unitId]: "OK", [u2.unitId]: "OK", [u3.unitId]: "DANIFICADA" } }],
    });
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 4, qtyMaintenance: 1, qtyRented: 0 });
    expect((await db.productUnit.findUniqueOrThrow({ where: { id: u3.unitId } })).status).toBe("MAINTENANCE");
  });
});

describe("status e atrasos", () => {
  it("não permite cancelar depois que saiu nem pular etapas", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const r = await createRental(db, users.employee, { ...rentalInput(p.id, 1, at(0, 0), at(1)), status: "SAIU" });
    await expect(changeRentalStatus(db, users.employee, r.id, "CANCELADA")).rejects.toThrow(/Não é possível mudar/);
    await expect(changeRentalStatus(db, users.employee, r.id, "FINALIZADA")).rejects.toThrow(/Não é possível mudar/);
    await expect(changeRentalStatus(db, users.employee, r.id, "CONFERIDA")).rejects.toThrow(/tela de conferência/);
  });

  it("cancelar uma reserva libera o estoque da data", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const r = await createRental(db, users.employee, { ...rentalInput(p.id, 5, at(3), at(4)), status: "RESERVADA" });
    await changeRentalStatus(db, users.employee, r.id, "CANCELADA");
    await createRental(db, users.employee, { ...rentalInput(p.id, 5, at(3), at(4)), status: "RESERVADA" });
  });

  it("locação fora e com retorno vencido continua ocupando o estoque", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const r = await createRental(db, users.employee, { ...rentalInput(p.id, 5, at(0, 0), at(1)), status: "SAIU" });
    // simula o atraso: retorno previsto já passou
    await db.rental.update({ where: { id: r.id }, data: { departureAt: at(-3), expectedReturnAt: at(-1) } });
    const avail = await availabilityForPeriod(db, [p.id], at(0, 0), at(0, 23));
    expect(avail.get(p.id)?.free).toBe(0);
  });

  it("não aceita retorno antes da saída", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    await expect(
      createRental(db, users.employee, { ...rentalInput(p.id, 1, at(4), at(3)), status: "RESERVADA" }),
    ).rejects.toThrow(/depois da saída/);
  });
});
