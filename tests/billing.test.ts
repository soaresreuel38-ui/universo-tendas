import { beforeEach, describe, expect, it } from "vitest";
import { periodEnd, periodLabel, periodsBetween, tablePrice } from "@/lib/billing";
import type { ContractSnapshot } from "@/lib/contract-types";
import { createContractFromRental } from "@/server/contracts";
import { createRental, updateRental } from "@/server/rentals";
import { at, db, makeProduct, makeUsers, resetDb } from "./helpers";

describe("modalidade diária / mensal — cálculo", () => {
  const d = (s: string) => new Date(s);
  it("conta diárias por 24 h iniciadas e meses de calendário iniciados", () => {
    expect(periodsBetween("DIARIA", d("2026-10-01T08:00:00Z"), d("2026-10-01T18:00:00Z"))).toBe(1);
    expect(periodsBetween("DIARIA", d("2026-10-01T08:00:00Z"), d("2026-10-02T08:00:00Z"))).toBe(1);
    expect(periodsBetween("DIARIA", d("2026-10-01T08:00:00Z"), d("2026-10-02T18:00:00Z"))).toBe(2);
    expect(periodsBetween("MENSAL", d("2026-10-01T08:00:00Z"), d("2026-10-31T08:00:00Z"))).toBe(1);
    expect(periodsBetween("MENSAL", d("2026-10-05T08:00:00Z"), d("2026-11-05T08:00:00Z"))).toBe(1);
    expect(periodsBetween("MENSAL", d("2026-10-01T08:00:00Z"), d("2026-11-15T08:00:00Z"))).toBe(2);
    expect(periodEnd("MENSAL", d("2026-01-31T08:00:00Z"), 1).toISOString()).toBe("2026-02-28T08:00:00.000Z");
    expect(periodEnd("DIARIA", d("2026-10-01T08:00:00Z"), 3).toISOString()).toBe("2026-10-04T08:00:00.000Z");
    expect(periodsBetween("DIARIA", d("2026-10-02T08:00:00Z"), d("2026-10-01T08:00:00Z"))).toBe(1);
  });
  it("rótulos e preço de tabela por modalidade", () => {
    expect(periodLabel("DIARIA", 1)).toBe("1 diária");
    expect(periodLabel("DIARIA", 3)).toBe("3 diárias");
    expect(periodLabel("MENSAL", 2)).toBe("2 meses");
    expect(tablePrice({ rentalPriceCents: 500, monthlyPriceCents: 9000 }, "MENSAL")).toBe(9000);
    expect(tablePrice({ rentalPriceCents: 500, monthlyPriceCents: null }, "MENSAL")).toBeNull();
    expect(tablePrice({ rentalPriceCents: 500 }, "DIARIA")).toBe(500);
  });
});

describe("modalidade diária / mensal — locação e contrato", () => {
  let users: Awaited<ReturnType<typeof makeUsers>>;
  let customerId: string;
  beforeEach(async () => {
    await resetDb();
    users = await makeUsers();
    customerId = (await db.customer.create({ data: { name: "Cliente Mensal", phone: "66999990000" } })).id;
  });

  it("grava a modalidade, leva para o contrato e mantém ao editar sem informar", async () => {
    const p = await makeProduct(users.admin, { name: "Tenda 10x10", sku: "T1010", initialQty: 4 });
    const r = await createRental(db, users.employee, {
      customerId,
      eventName: "Obra",
      departureAt: at(2),
      expectedReturnAt: at(62),
      billingMode: "MENSAL",
      periodCount: 2,
      items: [{ productId: p.id, quantity: 1, unitPriceCents: 1800000 }],
      status: "RESERVADA",
    });
    expect(r).toMatchObject({ billingMode: "MENSAL", periodCount: 2, totalCents: 1800000 });

    // Edição sem a modalidade (formulário antigo) não apaga o que foi combinado
    await updateRental(db, users.employee, r.id, {
      customerId,
      eventName: "Obra (ajustada)",
      departureAt: at(2),
      expectedReturnAt: at(62),
      items: [{ productId: p.id, quantity: 1, unitPriceCents: 1800000 }],
    });
    expect(await db.rental.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ billingMode: "MENSAL", periodCount: 2 });

    const c = await createContractFromRental(db, users.employee, r.id);
    expect((c.snapshot as unknown as ContractSnapshot).rental).toMatchObject({ billingMode: "MENSAL", periodCount: 2 });
  });

  it("padrão é diária e recusa quantidade de períodos inválida", async () => {
    const p = await makeProduct(users.admin, { name: "Tenda 3x3", sku: "T33", initialQty: 4 });
    const base = { customerId, eventName: "Festa", departureAt: at(2), expectedReturnAt: at(3), items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }], status: "ORCAMENTO" as const };
    expect(await createRental(db, users.employee, base)).toMatchObject({ billingMode: "DIARIA", periodCount: 1 });
    await expect(createRental(db, users.employee, { ...base, periodCount: 0 })).rejects.toThrow(/diárias\/meses inválida/);
  });
});
