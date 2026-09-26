import { beforeEach, describe, expect, it } from "vitest";
import type { ContractSnapshot } from "@/lib/contract-types";
import {
  cancelContract,
  createContractFromRental,
  createSignLink,
  findContractByToken,
  markContractSent,
  refreshContract,
  registerManualSignature,
  signContractByToken,
  signContractInPerson,
} from "@/server/contracts";
import { changeRentalStatus, checkInRental, createRental, departRental, updateRental } from "@/server/rentals";
import { createSale } from "@/server/sales";
import { registerRentalPayment } from "@/server/payments";
import { at, db, makeCustomer, makeProduct, makeUsers, product, resetDb } from "./helpers";

let users: Awaited<ReturnType<typeof makeUsers>>;
let customerId: string;

// PNG mínimo válido para o teste (cabeçalho + conteúdo).
const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]);

beforeEach(async () => {
  await resetDb();
  users = await makeUsers();
  customerId = (await db.customer.create({
    data: { name: "Maria Souza", document: "123.456.789-00", phone: "66999990000", address: "Rua A, 10", city: "Sinop - MT" },
  })).id;
});

async function quote(productId: string, quantity: number, from = at(3), to = at(4)) {
  return createRental(db, users.employee, {
    customerId,
    eventName: "Casamento",
    eventAddress: "Chácara Recanto",
    departureAt: from,
    expectedReturnAt: to,
    items: [{ productId, quantity, unitPriceCents: 20000 }],
    discountCents: 5000,
    status: "ORCAMENTO",
  });
}

describe("contrato gerado a partir da locação", () => {
  it("FLUXO 1: orçamento → contrato → envio → assinaturas → reserva confirmada → saída → retorno", async () => {
    const p = await makeProduct(users.admin, { name: "Tenda 4x4 Piramidal", sku: "T44", initialQty: 10 });
    const r = await quote(p.id, 4);

    const c = await createContractFromRental(db, users.employee, r.id);
    expect(c.number).toBe(1);
    expect(c.status).toBe("RASCUNHO");
    expect((await db.rental.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("RESERVADA");

    // Tudo preenchido automaticamente a partir do cadastro
    const snap = c.snapshot as unknown as ContractSnapshot;
    expect(snap.customer).toMatchObject({ name: "Maria Souza", document: "123.456.789-00", address: "Rua A, 10", city: "Sinop - MT" });
    expect(snap.items).toEqual([expect.objectContaining({ code: "T44", name: "Tenda 4x4 Piramidal", quantity: 4, unitPriceCents: 20000, totalCents: 80000 })]);
    expect(snap).toMatchObject({ subtotalCents: 80000, discountCents: 5000, totalCents: 75000 });
    expect(snap.rental.eventAddress).toBe("Chácara Recanto");
    expect(snap.clauses).toEqual([]); // nenhuma cláusula inventada
    expect(c.contentHash).toMatch(/^[a-f0-9]{64}$/);

    await markContractSent(db, users.employee, c.id);
    const token = await createSignLink(db, users.employee, c.id);
    expect((await db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("AGUARDANDO_ASSINATURA");

    await signContractByToken(db, token, { signerName: "Maria Souza", imagePng: fakePng, ip: "1.2.3.4" });
    // Gerar ou uma assinatura só não bastam: continua aguardando a empresa
    expect((await db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("AGUARDANDO_ASSINATURA");

    await signContractInPerson(db, users.employee, c.id, { party: "EMPRESA", signerName: "Func Teste", imagePng: fakePng });
    const signed = await db.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect(signed.status).toBe("ASSINADO");
    expect(signed.signedAt).not.toBeNull();
    expect(signed.signTokenHash).toBeNull();
    expect((await db.rental.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CONFIRMADA");

    // FLUXO 2: saída → contrato ativo, estoque atualizado
    await db.rental.update({ where: { id: r.id }, data: { departureAt: at(0, 0), expectedReturnAt: at(2) } });
    await departRental(db, users.employee, r.id);
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 6, qtyRented: 4 });
    expect((await db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("ATIVO");

    // FLUXO 3: retorno com dano → manutenção + ocorrência
    const item = await db.rentalItem.findFirstOrThrow({ where: { rentalId: r.id } });
    const photo = await db.photo.create({ data: { mime: "image/png", size: 10, data: new Uint8Array(fakePng), uploadedById: users.employee.id } });
    await checkInRental(db, users.employee, r.id, {
      items: [{ itemId: item.id, good: 3, damaged: 1, missing: 0, note: "Lona rasgada", damage: { damageType: "Rasgo / furo na lona", responsible: "Cliente", photoIds: [photo.id] } }],
    });
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 9, qtyMaintenance: 1, qtyRented: 0 });
    const report = await db.damageReport.findFirstOrThrow({ where: { rentalId: r.id }, include: { photos: true } });
    expect(report).toMatchObject({ quantity: 1, damageType: "Rasgo / furo na lona", responsible: "Cliente", description: "Lona rasgada" });
    expect(report.photos.map((x) => x.id)).toEqual([photo.id]);
    expect((await db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("FINALIZADO");

    const log = await db.auditLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(log.map((l) => l.action)).toEqual(
      expect.arrayContaining(["rental.create", "rental.reserve", "contract.create", "contract.send", "contract.signed", "rental.depart", "rental.checkin"]),
    );
    expect(log.every((l) => l.summary.length > 0)).toBe(true);
  });

  it("estoque 10, reservado 6: gerar contrato de orçamento com 5 é bloqueado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    await createRental(db, users.employee, {
      customerId, eventName: "Outro evento", departureAt: at(3), expectedReturnAt: at(4),
      items: [{ productId: p.id, quantity: 6, unitPriceCents: 0 }], status: "RESERVADA",
    });
    const r = await quote(p.id, 5);
    await expect(createContractFromRental(db, users.employee, r.id)).rejects.toThrow(/Não há estoque suficiente para o período selecionado/);
    expect((await db.rental.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("ORCAMENTO");
    expect(await db.contract.count()).toBe(0);
  });

  it("numeração automática nunca se repete; um contrato ativo por locação", async () => {
    const p = await makeProduct(users.admin, { initialQty: 50 });
    const a = await createContractFromRental(db, users.employee, (await quote(p.id, 1)).id);
    const rb = await quote(p.id, 1);
    const b = await createContractFromRental(db, users.employee, rb.id);
    expect([a.number, b.number]).toEqual([1, 2]);
    await expect(createContractFromRental(db, users.employee, rb.id)).rejects.toThrow(/já tem o contrato #000002/);
    await cancelContract(db, users.admin, b.id, "Cliente pediu mudança");
    const b2 = await createContractFromRental(db, users.employee, rb.id);
    expect(b2.number).toBe(3);
  });

  it("rascunho acompanha a locação; depois de enviado fica congelado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 20 });
    const r = await quote(p.id, 2);
    const c = await createContractFromRental(db, users.employee, r.id);
    await updateRental(db, users.employee, r.id, {
      customerId, eventName: "Casamento", departureAt: at(3), expectedReturnAt: at(4), items: [{ productId: p.id, quantity: 3, unitPriceCents: 20000 }],
    });
    const refreshed = await refreshContract(db, users.employee, c.id);
    expect((refreshed.snapshot as unknown as ContractSnapshot).items[0].quantity).toBe(3);
    await markContractSent(db, users.employee, c.id);
    await expect(refreshContract(db, users.employee, c.id)).rejects.toThrow(/congelado/);
  });

  it("usa apenas as cláusulas escritas pela empresa", async () => {
    await db.contractTemplate.create({
      data: { id: "default", cnpj: "00.000.000/0001-00", clauses: [{ title: "Devolução", body: "Texto da empresa." }, { title: "Danos", body: "" }] },
    });
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const c = await createContractFromRental(db, users.employee, (await quote(p.id, 1)).id);
    const snap = c.snapshot as unknown as ContractSnapshot;
    expect(snap.clauses).toEqual([{ title: "Devolução", body: "Texto da empresa." }]);
    expect(snap.company.cnpj).toBe("00.000.000/0001-00");
  });

  it("link de assinatura: inválido, expirado ou reutilizado é recusado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const c = await createContractFromRental(db, users.employee, (await quote(p.id, 1)).id);
    const token = await createSignLink(db, users.employee, c.id);
    expect(await findContractByToken(db, "x".repeat(32))).toBeNull();
    await expect(signContractByToken(db, "y".repeat(32), { signerName: "A", imagePng: fakePng })).rejects.toThrow(/inválido ou expirado/);
    await signContractByToken(db, token, { signerName: "Maria", imagePng: fakePng });
    await expect(signContractByToken(db, token, { signerName: "Maria", imagePng: fakePng })).rejects.toThrow(/já assinou/);

    const c2 = await createContractFromRental(db, users.employee, (await quote(p.id, 1, at(6), at(7))).id);
    const t2 = await createSignLink(db, users.employee, c2.id);
    await db.contract.update({ where: { id: c2.id }, data: { signTokenExpiresAt: new Date(Date.now() - 1000) } });
    await expect(signContractByToken(db, t2, { signerName: "Maria", imagePng: fakePng })).rejects.toThrow(/expirado/);
    await expect(signContractByToken(db, token.slice(0, 10), { signerName: "M", imagePng: Buffer.from("nope") })).rejects.toThrow();
  });

  it("contrato assinado em papel: anexa o arquivo e marca como assinado", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const r = await quote(p.id, 1);
    const c = await createContractFromRental(db, users.employee, r.id);
    await registerManualSignature(db, users.employee, c.id, { file: Buffer.from("%PDF-1.4 teste"), mime: "application/pdf", fileName: "assinado.pdf", clientName: "Maria Souza" });
    const after = await db.contract.findUniqueOrThrow({ where: { id: c.id }, include: { signatures: true, documents: true } });
    expect(after.status).toBe("ASSINADO");
    expect(after.signatures.map((s) => s.method)).toEqual(["MANUAL", "MANUAL"]);
    expect(after.documents).toHaveLength(1);
    expect((await db.rental.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CONFIRMADA");
  });

  it("funcionário não cancela contrato; cancelar a locação cancela o contrato", async () => {
    const p = await makeProduct(users.admin, { initialQty: 5 });
    const r = await quote(p.id, 1);
    const c = await createContractFromRental(db, users.employee, r.id);
    await expect(cancelContract(db, users.employee, c.id, "x")).rejects.toThrow(/permissão/);
    await changeRentalStatus(db, users.employee, r.id, "CANCELADA");
    expect((await db.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("CANCELADO");
    await expect(signContractInPerson(db, users.employee, c.id, { party: "EMPRESA", signerName: "F", imagePng: fakePng })).rejects.toThrow(/não aceita/);
  });
});

describe("pagamentos", () => {
  it("FLUXO 4: venda com pagamento reduz o estoque definitivamente", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const c = await makeCustomer();
    const sale = await createSale(db, users.employee, {
      customerId: c.id,
      items: [{ productId: p.id, quantity: 2, unitPriceCents: 150000 }],
      payment: { amountCents: 300000, method: "PIX" },
    });
    expect(sale.payments).toHaveLength(1);
    expect(await product(p.id)).toMatchObject({ qtyAvailable: 8, qtySold: 2 });
  });

  it("pagamento de locação exige valor positivo", async () => {
    const p = await makeProduct(users.admin, { initialQty: 10 });
    const r = await quote(p.id, 1);
    await expect(registerRentalPayment(db, users.employee, r.id, { amountCents: 0, method: "PIX" })).rejects.toThrow(/maior que zero/);
    await registerRentalPayment(db, users.employee, r.id, { amountCents: 5000, method: "DINHEIRO" });
    expect(await db.payment.count({ where: { rentalId: r.id } })).toBe(1);
  });
});
