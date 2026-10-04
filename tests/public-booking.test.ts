import { beforeEach, describe, expect, it } from "vitest";
import { addDays, startOfDay, todayKey } from "@/lib/time";
import { availabilityForPeriod, reservedByProduct } from "@/server/availability";
import { createContractFromRental } from "@/server/contracts";
import {
  createOnlineReservation,
  findRentalByCode,
  findRentalByToken,
  publicAvailability,
  requestCancellation,
  type ReservationRequest,
} from "@/server/public-booking";
import { changeRentalStatus, createRental, updateRental } from "@/server/rentals";
import { at, db, makeCustomer, makeProduct, makeUsers, product, resetDb } from "./helpers";

/**
 * Site público → mesmo backend, mesmo banco, mesma regra de disponibilidade do painel.
 * Rodam contra o PostgreSQL de TESTE (TEST_DATABASE_URL), que é apagado a cada teste.
 */

let users: Awaited<ReturnType<typeof makeUsers>>;

beforeEach(async () => {
  await resetDb();
  users = await makeUsers();
});

/** CPF/CNPJ válidos calculados (não são documentos de pessoas reais conhecidas). */
function cpf(base9: string) {
  const d = base9.split("").map(Number);
  for (const len of [9, 10]) {
    const sum = d.slice(0, len).reduce((s, n, i) => s + n * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d.join("");
}
function cnpj(base12: string) {
  const d = base12.split("").map(Number);
  for (const w of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const r = w.reduce((s, x, i) => s + d[i] * x, 0) % 11;
    d.push(r < 2 ? 0 : 11 - r);
  }
  return d.join("");
}

const day = (offset: number) => addDays(todayKey(), offset);

function request(productId: string, quantity: number, start = day(10), end = day(12), overrides: Partial<ReservationRequest> = {}): ReservationRequest {
  return {
    items: [{ productId, quantity }],
    eventStart: start,
    eventEnd: end,
    address: { zipCode: "78550-000", street: "Rua das Flores", number: "100", district: "Centro", city: "Sinop", state: "MT", notes: "Entrada lateral" },
    customer: { personType: "PF", name: "Cliente do Site", document: cpf("529982247"), whatsapp: "(66) 99999-1111", email: "cliente@teste.local" },
    ...overrides,
  };
}

async function free(productId: string, start = day(10), end = day(12)) {
  return (await publicAvailability(db, [productId], start, end)).free[productId];
}

describe("site público usando o estoque do painel", () => {
  it("TESTE 1 — cliente reserva produto disponível: reserva criada de verdade no banco", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10, rentalPriceCents: 25000 });
    const r = await createOnlineReservation(db, request(p.id, 4));

    const rental = await db.rental.findUniqueOrThrow({ where: { number: r.number }, include: { items: true, customer: true } });
    expect(rental.source).toBe("SITE");
    expect(rental.status).toBe("RESERVADA"); // modo manual (padrão): aguardando aprovação, segurando estoque
    expect(rental.createdById).toBeNull();
    expect(rental.departureAt).toEqual(startOfDay(day(9)));
    expect(rental.expectedReturnAt).toEqual(startOfDay(day(14)));
    expect(rental.eventCity).toBe("Sinop");
    expect(rental.eventNotes).toBe("Entrada lateral");
    expect(rental.items).toEqual([expect.objectContaining({ productId: p.id, quantity: 4, unitPriceCents: 75000 })]); // diária R$ 250 × 3 dias de evento
    expect(rental.billingMode).toBe("DIARIA");
    expect(rental.periodCount).toBe(3); // a margem bloqueia estoque, mas não é cobrada
    expect(rental.totalCents).toBe(300000);
    expect(rental.customer.document).toBe("529.982.247-25");
    expect(await findRentalByToken(db, r.token)).not.toBeNull();
  });

  it("TESTE 2 — a reserva aparece para o admin: mesma linha, mesmo banco", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const r = await createOnlineReservation(db, request(p.id, 3));
    // Mesma consulta usada pela aba "Do site" em /admin/locacoes.
    const adminList = await db.rental.findMany({ where: { source: "SITE" } });
    expect(adminList.map((x) => x.number)).toEqual([r.number]);
    // E o painel pode operá-la com as funções de sempre (aprovar).
    await changeRentalStatus(db, users.employee, adminList[0].id, "CONFIRMADA");
    expect((await db.rental.findUniqueOrThrow({ where: { id: adminList[0].id } })).status).toBe("CONFIRMADA");
  });

  it("TESTE 3 — estoque atualizado: 10 total, 4 reservadas, 6 livres no período", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    expect(await free(p.id)).toBe(10);
    await createOnlineReservation(db, request(p.id, 4));
    expect(await free(p.id)).toBe(6);
    expect((await reservedByProduct(db, [p.id])).get(p.id)).toBe(4);
    // O físico não muda na reserva: só na saída (mesma regra do painel).
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 10, qtyRented: 0 });
  });

  it("TESTE 4 — estoque insuficiente é bloqueado no servidor", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    await createOnlineReservation(db, request(p.id, 4));
    await expect(createOnlineReservation(db, request(p.id, 7))).rejects.toThrow("Não há estoque suficiente para o período selecionado");
    expect(await db.rental.count()).toBe(1);
  });

  it("TESTE 5 — dois clientes ao mesmo tempo não geram overbooking", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const results = await Promise.allSettled([
      createOnlineReservation(db, request(p.id, 3)),
      createOnlineReservation(db, request(p.id, 4, day(10), day(12), { customer: { personType: "PF", name: "Outro Cliente", document: cpf("123456789"), whatsapp: "66988887777", email: "outro@teste.local" } })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const reserved = (await reservedByProduct(db, [p.id])).get(p.id) ?? 0;
    expect(reserved).toBeLessThanOrEqual(5);
  });

  it("TESTE 5b — site e painel ao mesmo tempo, várias tentativas: nunca passa do estoque", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const customer = await makeCustomer();
    const attempts = await Promise.allSettled([
      ...Array.from({ length: 4 }, (_, i) =>
        createOnlineReservation(db, request(p.id, 3, day(10), day(12), { customer: { personType: "PF", name: `Cliente ${i}`, document: cpf(`52998224${i}`), whatsapp: "66999990000", email: `c${i}@teste.local` } })),
      ),
      ...Array.from({ length: 3 }, () =>
        createRental(db, users.employee, { customerId: customer.id, eventName: "Feira", departureAt: startOfDay(day(9)), expectedReturnAt: startOfDay(day(14)), items: [{ productId: p.id, quantity: 3, unitPriceCents: 0 }], status: "RESERVADA" }),
      ),
    ]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(3); // 3 × 3 = 9 de 10
    const peak = (await availabilityForPeriod(db, [p.id], startOfDay(day(9)), startOfDay(day(14)))).get(p.id)!;
    expect(peak.free).toBe(1);
  });

  it("TESTE 6 — cliente pede cancelamento: estoque só é liberado quando o admin cancela", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const r = await createOnlineReservation(db, request(p.id, 2));
    const rental = (await findRentalByToken(db, r.token))!;

    await requestCancellation(db, rental.id, "Mudamos a data");
    expect(await free(p.id)).toBe(8); // pedido não libera nada
    const pending = await db.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(pending.status).toBe("RESERVADA");
    expect(pending.cancelRequestedAt).not.toBeNull();

    await changeRentalStatus(db, users.employee, rental.id, "CANCELADA");
    expect(await free(p.id)).toBe(10); // RESERVADO −2, DISPONÍVEL +2
  });

  it("TESTE 7 — locação criada no painel reduz o que o site oferece", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const customer = await makeCustomer();
    await createRental(db, users.employee, {
      customerId: customer.id,
      eventName: "Evento do painel",
      departureAt: at(10),
      expectedReturnAt: at(11),
      items: [{ productId: p.id, quantity: 6, unitPriceCents: 0 }],
      status: "CONFIRMADA",
    });
    expect(await free(p.id)).toBe(4);
    await expect(createOnlineReservation(db, request(p.id, 5))).rejects.toThrow("Não há estoque suficiente");
  });

  it("TESTE 8 — reserva online vira contrato com os dados da locação", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10, rentalPriceCents: 30000 });
    const r = await createOnlineReservation(db, request(p.id, 2));
    const rental = (await findRentalByToken(db, r.token))!;
    await changeRentalStatus(db, users.admin, rental.id, "CONFIRMADA");
    const contract = await createContractFromRental(db, users.employee, rental.id);
    const snap = contract.snapshot as { customer: { name: string }; rental: { eventAddress: string }; items: Array<{ quantity: number; unitPriceCents: number }>; totalCents: number };
    expect(snap.customer.name).toBe("Cliente do Site");
    expect(snap.rental.eventAddress).toContain("Rua das Flores, 100");
    expect(snap.items[0]).toMatchObject({ quantity: 2, unitPriceCents: 90000 }); // R$ 300/dia × 3 dias
    expect(snap.totalCents).toBe(180000);
  });

  it("TESTE 10 — mudar as datas recalcula a disponibilidade", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    await createOnlineReservation(db, request(p.id, 8, day(10), day(12)));
    expect(await free(p.id, day(10), day(12))).toBe(2);
    expect(await free(p.id, day(13), day(13))).toBe(2); // margem: 13 ainda é retorno do primeiro evento
    expect(await free(p.id, day(16), day(17))).toBe(10); // sem sobreposição
    expect(await free(p.id, day(8), day(8))).toBe(2); // evento no dia 08 precisa do dia 09 (margem depois), já ocupado
  });
});

describe("segurança das entradas do site", () => {
  it("preço vem do cadastro, nunca do navegador", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10, rentalPriceCents: 25000 });
    const raw = request(p.id, 1) as ReservationRequest & { items: Array<{ productId: string; quantity: number; unitPriceCents?: number }> };
    raw.items[0].unitPriceCents = 1;
    const r = await createOnlineReservation(db, raw);
    const item = await db.rentalItem.findFirstOrThrow({ where: { rental: { number: r.number } } });
    expect(item.unitPriceCents).toBe(75000); // R$ 250/dia × 3 dias, ignorando o valor enviado
  });

  it("produto sem preço: aceita e marca 'valor a consultar' (sem inventar preço)", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10, rentalPriceCents: null });
    const r = await createOnlineReservation(db, request(p.id, 2));
    const rental = await db.rental.findUniqueOrThrow({ where: { number: r.number } });
    expect(rental.pricePending).toBe(true);
    expect(rental.totalCents).toBe(0);
    // Ao revisar no painel, o admin define o valor e a marca some.
    await updateRental(db, users.admin, rental.id, {
      customerId: rental.customerId,
      eventName: rental.eventName,
      departureAt: rental.departureAt,
      expectedReturnAt: rental.expectedReturnAt,
      items: [{ productId: p.id, quantity: 2, unitPriceCents: 18000 }],
    });
    expect((await db.rental.findUniqueOrThrow({ where: { id: rental.id } })).pricePending).toBe(false);
  });

  it("recusa produto fora do site, só de venda ou desativado", async () => {
    const hidden = await makeProduct(users.admin, { initialQty: 10, showOnSite: false });
    const saleOnly = await makeProduct(users.admin, { initialQty: 10, kind: "SALE" });
    await expect(createOnlineReservation(db, request(hidden.id, 1))).rejects.toThrow(/não está mais disponível/);
    await expect(createOnlineReservation(db, request(saleOnly.id, 1))).rejects.toThrow(/não está mais disponível/);
  });

  it("recusa CPF inválido, quantidade zero e datas passadas", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    await expect(createOnlineReservation(db, request(p.id, 1, day(10), day(12), { customer: { personType: "PF", name: "X", document: "111.111.111-11", whatsapp: "66999990000", email: "x@teste.local" } }))).rejects.toThrow(/CPF/);
    await expect(createOnlineReservation(db, request(p.id, 0))).rejects.toThrow();
    await expect(createOnlineReservation(db, request(p.id, 1, day(-2), day(-1)))).rejects.toThrow(/já passou/);
    expect(await db.rental.count()).toBe(0);
  });

  it("pessoa jurídica: grava razão social, nome fantasia e responsável", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const r = await createOnlineReservation(
      db,
      request(p.id, 1, day(10), day(12), {
        customer: { personType: "PJ", name: "Empresa Teste Ltda", tradeName: "Eventos Teste", contactName: "Ana", document: cnpj("112223330001"), whatsapp: "66999990000", email: "pj@teste.local" },
      }),
    );
    const c = (await db.rental.findUniqueOrThrow({ where: { number: r.number }, include: { customer: true } })).customer;
    expect(c).toMatchObject({ personType: "PJ", name: "Empresa Teste Ltda", tradeName: "Eventos Teste", contactName: "Ana" });
  });

  it("cliente já cadastrado (mesmo CPF) é reaproveitado, sem sobrescrever os dados do painel", async () => {
    const existing = await db.customer.create({ data: { name: "Nome do Painel", document: "529.982.247-25", phone: "(66) 3531-0000" } });
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const r = await createOnlineReservation(db, request(p.id, 1));
    const rental = await db.rental.findUniqueOrThrow({ where: { number: r.number }, include: { customer: true } });
    expect(rental.customerId).toBe(existing.id);
    expect(rental.customer.name).toBe("Nome do Painel");
    expect(rental.notes).toContain("Cliente do Site"); // o que foi digitado no site fica registrado na locação
  });

  it("consulta da reserva exige número + telefone corretos", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const r = await createOnlineReservation(db, request(p.id, 1));
    expect(await findRentalByCode(db, r.code, "66 99999-1111")).not.toBeNull();
    expect(await findRentalByCode(db, r.code, "66 90000-0000")).toBeNull();
    expect(await findRentalByToken(db, "x".repeat(32))).toBeNull();
  });

  it("modo automático (configuração do admin): já nasce CONFIRMADA", async () => {
    await db.businessSettings.create({ data: { id: "default", onlineAutoConfirm: true } });
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const r = await createOnlineReservation(db, request(p.id, 1));
    expect(r.status).toBe("CONFIRMADA");
  });

  it("reservas pausadas nas configurações são recusadas", async () => {
    await db.businessSettings.create({ data: { id: "default", onlineBookingEnabled: false } });
    const p = await makeProduct(users.admin, { initialQty: 10 });
    await expect(createOnlineReservation(db, request(p.id, 1))).rejects.toThrow(/pausadas/);
  });
});

describe("cenários exigidos para produção", () => {
  it("CONCORRÊNCIA — 1 unidade, duas solicitações simultâneas e conflitantes: só uma reserva", async () => {
    const p = await makeProduct(users.admin, { initialQty: 1 });
    const other = { personType: "PF" as const, name: "Segundo Cliente", document: cpf("111444777"), whatsapp: "66977776666", email: "segundo@teste.local" };
    // Repetido várias vezes para não depender de sorte no agendamento.
    for (let round = 0; round < 5; round++) {
      await db.rentalItem.deleteMany();
      await db.auditLog.deleteMany();
      await db.rental.deleteMany();
      const results = await Promise.allSettled([
        createOnlineReservation(db, request(p.id, 1, day(20), day(21))),
        createOnlineReservation(db, request(p.id, 1, day(21), day(22), { customer: other })),
      ]);
      const ok = results.filter((r) => r.status === "fulfilled");
      const fail = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(ok).toHaveLength(1);
      expect(fail).toHaveLength(1);
      expect(String(fail[0].reason?.message)).toContain("Não há estoque suficiente para o período selecionado");
      const active = await db.rental.count({ where: { status: { in: ["RESERVADA", "CONFIRMADA"] } } });
      expect(active).toBe(1);
      expect(await free(p.id, day(20), day(22))).toBe(0);
    }
  });

  it("CONCORRÊNCIA — 1 unidade: site e painel ao mesmo tempo", async () => {
    const p = await makeProduct(users.admin, { initialQty: 1 });
    const customer = await makeCustomer();
    const results = await Promise.allSettled([
      createOnlineReservation(db, request(p.id, 1, day(20), day(21))),
      createRental(db, users.employee, { customerId: customer.id, eventName: "Balcão", departureAt: startOfDay(day(20)), expectedReturnAt: startOfDay(day(21)), items: [{ productId: p.id, quantity: 1, unitPriceCents: 0 }], status: "CONFIRMADA" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("MARGEM — evento 10→12 bloqueia 09 a 13; 14 fica livre", async () => {
    const p = await makeProduct(users.admin, { initialQty: 1 });
    const s = day(30); // "10/10"
    const e = addDays(s, 2); // "12/10"
    await createOnlineReservation(db, request(p.id, 1, s, e));
    const rental = await db.rental.findFirstOrThrow();
    expect(rental.departureAt).toEqual(startOfDay(addDays(s, -1))); // saída 09
    expect(rental.expectedReturnAt).toEqual(startOfDay(addDays(e, 2))); // retorno até o fim do 13
    // Uma locação de um único dia, do painel, em cada data de 09 a 14:
    for (let offset = -1; offset <= 4; offset++) {
      const d = addDays(s, offset);
      const map = await availabilityForPeriod(db, [p.id], startOfDay(d), startOfDay(addDays(d, 1)));
      expect({ dia: offset + 10, livre: map.get(p.id)!.free }).toEqual({ dia: offset + 10, livre: offset <= 3 ? 0 : 1 });
    }
  });

  it("MARGEM — admin ajusta manualmente saída e retorno: a disponibilidade acompanha", async () => {
    const p = await makeProduct(users.admin, { initialQty: 1 });
    const s = day(30);
    const e = addDays(s, 2);
    await createOnlineReservation(db, request(p.id, 1, s, e));
    const r = await db.rental.findFirstOrThrow({ include: { items: true } });
    // Admin encurta: saída no próprio dia 10, retorno no fim do dia 12.
    await updateRental(db, users.admin, r.id, {
      customerId: r.customerId,
      eventName: r.eventName,
      departureAt: startOfDay(s),
      expectedReturnAt: startOfDay(addDays(e, 1)),
      items: r.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    });
    const at09 = await availabilityForPeriod(db, [p.id], startOfDay(addDays(s, -1)), startOfDay(s));
    const at13 = await availabilityForPeriod(db, [p.id], startOfDay(addDays(e, 1)), startOfDay(addDays(e, 2)));
    expect(at09.get(p.id)!.free).toBe(1);
    expect(at13.get(p.id)!.free).toBe(1);
    // Admin estende o retorno até o dia 15: dia 14 passa a ficar ocupado.
    await updateRental(db, users.admin, r.id, {
      customerId: r.customerId,
      eventName: r.eventName,
      departureAt: startOfDay(s),
      expectedReturnAt: startOfDay(addDays(e, 3)),
      items: r.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    });
    const at14 = await availabilityForPeriod(db, [p.id], startOfDay(addDays(e, 2)), startOfDay(addDays(e, 3)));
    expect(at14.get(p.id)!.free).toBe(0);
  });

  it("FLUXO — admin recusa a reserva do site: CANCELADA e estoque liberado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 3 });
    const r = await createOnlineReservation(db, request(p.id, 3));
    expect(await free(p.id)).toBe(0);
    const rental = (await findRentalByToken(db, r.token))!;
    await changeRentalStatus(db, users.employee, rental.id, "CANCELADA");
    const after = await db.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(after.status).toBe("CANCELADA");
    expect(after.canceledAt).not.toBeNull();
    expect(await free(p.id)).toBe(3);
  });

  it("FLUXO — admin dispensa o pedido de cancelamento: reserva mantida e estoque continua bloqueado", async () => {
    const { dismissCancelRequest } = await import("@/server/rentals");
    const p = await makeProduct(users.admin, { initialQty: 2 });
    const r = await createOnlineReservation(db, request(p.id, 2));
    const rental = (await findRentalByToken(db, r.token))!;
    await requestCancellation(db, rental.id, null);
    await dismissCancelRequest(db, users.employee, rental.id);
    const after = await db.rental.findUniqueOrThrow({ where: { id: rental.id } });
    expect(after.cancelRequestedAt).toBeNull();
    expect(after.status).toBe("RESERVADA");
    expect(await free(p.id)).toBe(0);
  });

  it("CANCELAMENTO — pedido não é aceito depois que as tendas saíram", async () => {
    const { departRental } = await import("@/server/rentals");
    const p = await makeProduct(users.admin, { initialQty: 2 });
    const r = await createOnlineReservation(db, request(p.id, 1, day(0), day(1)));
    const rental = (await findRentalByToken(db, r.token))!;
    await changeRentalStatus(db, users.admin, rental.id, "CONFIRMADA");
    await departRental(db, users.employee, rental.id);
    await expect(requestCancellation(db, rental.id, null)).rejects.toThrow(/não pode mais ser cancelada pelo site/);
  });
});
