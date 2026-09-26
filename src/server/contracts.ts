import { createHash, randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { CONTRACT_OPEN_STATUSES, type ContractStatus } from "@/lib/domain";
import type { ClauseInput, ContractSnapshot } from "@/lib/contract-types";
import { seq } from "@/lib/format";
import { lockProducts } from "./availability";
import { audit } from "./audit";
import { assertCan, DomainError, type Actor, type Db } from "./errors";
import { assertBookable } from "./rentals";
import { withTx } from "./stock";

const SIGN_LINK_DAYS = 7;

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export async function getContractTemplate(db: Db | PrismaClient) {
  return (
    (await db.contractTemplate.findUnique({ where: { id: "default" } })) ??
    (await db.contractTemplate.create({ data: { id: "default" } }))
  );
}

export function parseClauses(value: Prisma.JsonValue): ClauseInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is { title: string; body: string } => typeof c === "object" && c !== null && "title" in c && "body" in c)
    .map((c) => ({ title: String(c.title), body: String(c.body) }));
}

// ───────────────────────── Snapshot (dados congelados) ─────────────────────────

async function buildSnapshot(tx: Db, rentalId: string): Promise<ContractSnapshot> {
  const rental = await tx.rental.findUniqueOrThrow({
    where: { id: rentalId },
    include: { customer: true, items: { include: { product: true }, orderBy: { product: { name: "asc" } } } },
  });
  const template = await getContractTemplate(tx);
  const items = rental.items.map((i) => ({
    productId: i.productId,
    code: i.product.sku,
    name: i.product.name,
    unit: i.product.unit,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    totalCents: i.quantity * i.unitPriceCents,
  }));
  const subtotalCents = items.reduce((s, i) => s + i.totalCents, 0);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    company: {
      name: template.companyName,
      cnpj: template.cnpj,
      address: template.address,
      city: template.city,
      phones: template.phones,
      email: template.email,
      instagram: template.instagram,
    },
    customer: {
      name: rental.customer.name,
      document: rental.customer.document,
      phone: rental.customer.phone,
      whatsapp: rental.customer.whatsapp,
      email: rental.customer.email,
      address: rental.customer.address,
      city: rental.customer.city,
    },
    rental: {
      number: rental.number,
      eventName: rental.eventName,
      eventAddress: rental.eventAddress,
      setupAt: iso(rental.setupAt),
      departureAt: rental.departureAt.toISOString(),
      eventAt: iso(rental.eventAt),
      expectedReturnAt: rental.expectedReturnAt.toISOString(),
      teardownAt: iso(rental.teardownAt),
      pickupBy: rental.pickupBy,
      notes: rental.notes,
    },
    items,
    subtotalCents,
    discountCents: rental.discountCents,
    totalCents: rental.totalCents,
    paymentTerms: rental.paymentTerms ?? template.defaultPaymentTerms,
    intro: template.intro,
    // Só entram cláusulas que a empresa escreveu. Nada é inventado pelo sistema.
    clauses: parseClauses(template.clauses).filter((c) => c.title.trim() && c.body.trim()),
    footer: template.footer,
  };
}

function snapshotData(snapshot: ContractSnapshot) {
  const json = JSON.stringify(snapshot);
  return {
    snapshot: snapshot as unknown as Prisma.InputJsonValue,
    contentHash: sha256(json),
    items: {
      create: snapshot.items.map((i) => ({
        productId: i.productId,
        code: i.code,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        totalCents: i.totalCents,
      })),
    },
  };
}

async function lockContract(tx: Db, contractId: string) {
  await tx.$queryRaw`SELECT id FROM "Contract" WHERE id = ${contractId} FOR UPDATE`;
  const c = await tx.contract.findUnique({ where: { id: contractId }, include: { signatures: true, rental: true } });
  if (!c) throw new DomainError("Contrato não encontrado.");
  return c;
}

// ───────────────────────── Geração ─────────────────────────

/**
 * Gera o contrato a partir da locação (sem redigitar nada). Gerar o contrato significa que o
 * cliente aprovou: um orçamento passa a RESERVADA, com checagem de estoque no período.
 */
export async function createContractFromRental(db: PrismaClient, actor: Actor, rentalId: string) {
  assertCan(actor, "contract.manage");
  return withTx(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Rental" WHERE id = ${rentalId} FOR UPDATE`;
    const rental = await tx.rental.findUnique({ where: { id: rentalId }, include: { items: true } });
    if (!rental) throw new DomainError("Locação não encontrada.");
    if (rental.status === "CANCELADA") throw new DomainError("Locação cancelada não pode gerar contrato.");
    if (rental.items.length === 0) throw new DomainError("A locação não tem produtos.");
    const existing = await tx.contract.findFirst({ where: { rentalId, status: { not: "CANCELADO" } } });
    if (existing) throw new DomainError(`Esta locação já tem o contrato #${seq(existing.number)}.`);

    if (rental.status === "ORCAMENTO") {
      await lockProducts(tx, rental.items.map((i) => i.productId));
      try {
        await assertBookable(tx, rental.items, rental.departureAt, rental.expectedReturnAt, rental.id);
      } catch (e) {
        if (e instanceof DomainError) throw new DomainError(`Não há estoque suficiente para o período selecionado. ${e.message}`);
        throw e;
      }
      await tx.rental.update({ where: { id: rental.id }, data: { status: "RESERVADA" } });
      await audit(tx, { userId: actor.id, action: "rental.reserve", entityType: "Rental", entityId: rental.id, summary: `Orçamento #${seq(rental.number)} aprovado e reservado` });
    }

    const snapshot = await buildSnapshot(tx, rental.id);
    const contract = await tx.contract.create({
      data: { rentalId: rental.id, customerId: rental.customerId, createdById: actor.id, status: "RASCUNHO", ...snapshotData(snapshot) },
    });
    await audit(tx, {
      userId: actor.id,
      action: "contract.create",
      entityType: "Contract",
      entityId: contract.id,
      summary: `Gerou o contrato #${seq(contract.number)} da locação #${seq(rental.number)}`,
    });
    return contract;
  });
}

/** Rascunho acompanha alterações da locação; depois de enviado, o conteúdo fica congelado. */
export async function refreshContract(db: PrismaClient, actor: Actor, contractId: string) {
  assertCan(actor, "contract.manage");
  return withTx(db, async (tx) => {
    const c = await lockContract(tx, contractId);
    if (c.status !== "RASCUNHO") throw new DomainError("Só rascunhos podem ser atualizados. Depois de enviado, o contrato fica congelado.");
    if (!c.rentalId) throw new DomainError("Contrato sem locação vinculada.");
    const snapshot = await buildSnapshot(tx, c.rentalId);
    await tx.contractItem.deleteMany({ where: { contractId } });
    const updated = await tx.contract.update({ where: { id: contractId }, data: snapshotData(snapshot) });
    await audit(tx, { userId: actor.id, action: "contract.refresh", entityType: "Contract", entityId: contractId, summary: `Atualizou o rascunho do contrato #${seq(c.number)}` });
    return updated;
  });
}

// ───────────────────────── Envio e link de assinatura ─────────────────────────

export async function markContractSent(db: PrismaClient, actor: Actor, contractId: string) {
  assertCan(actor, "contract.manage");
  return withTx(db, async (tx) => {
    const c = await lockContract(tx, contractId);
    if (c.status !== "RASCUNHO") return c;
    const updated = await tx.contract.update({ where: { id: contractId }, data: { status: "ENVIADO", sentAt: new Date() } });
    await audit(tx, { userId: actor.id, action: "contract.send", entityType: "Contract", entityId: contractId, summary: `Enviou o contrato #${seq(c.number)}` });
    return updated;
  });
}

/** Cria (ou renova) o link para o cliente assinar pelo celular. O token só existe na mensagem enviada. */
export async function createSignLink(db: PrismaClient, actor: Actor, contractId: string) {
  assertCan(actor, "contract.manage");
  const token = randomBytes(24).toString("base64url");
  await withTx(db, async (tx) => {
    const c = await lockContract(tx, contractId);
    if (!CONTRACT_OPEN_STATUSES.includes(c.status as ContractStatus)) throw new DomainError("Este contrato não aceita mais assinaturas.");
    if (c.signatures.some((s) => s.party === "CLIENTE")) throw new DomainError("O cliente já assinou este contrato.");
    await tx.contract.update({
      where: { id: contractId },
      data: {
        status: "AGUARDANDO_ASSINATURA",
        sentAt: c.sentAt ?? new Date(),
        signTokenHash: sha256(token),
        signTokenExpiresAt: new Date(Date.now() + SIGN_LINK_DAYS * 86_400_000),
      },
    });
    await audit(tx, { userId: actor.id, action: "contract.sign_link", entityType: "Contract", entityId: contractId, summary: `Gerou link de assinatura do contrato #${seq(c.number)}` });
  });
  return token;
}

export async function findContractByToken(db: PrismaClient | Db, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const c = await db.contract.findUnique({ where: { signTokenHash: sha256(token) }, include: { signatures: true } });
  if (!c || !c.signTokenExpiresAt || c.signTokenExpiresAt < new Date()) return null;
  return c;
}

// ───────────────────────── Assinaturas ─────────────────────────

export type SignatureInput = {
  party: "CLIENTE" | "EMPRESA";
  signerName: string;
  signerDocument?: string | null;
  imagePng: Buffer;
  ip?: string | null;
  userAgent?: string | null;
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function validateSignatureImage(buf: Buffer) {
  if (buf.length < 100 || buf.length > 400_000 || !buf.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new DomainError("Assinatura inválida. Desenhe a assinatura novamente.");
  }
}

/** Depois de gravar uma assinatura: se cliente e empresa assinaram, o contrato fica ASSINADO e a reserva confirmada. */
async function completeIfSigned(tx: Db, contractId: string, actorId: string | null) {
  const c = await tx.contract.findUniqueOrThrow({ where: { id: contractId }, include: { signatures: true, rental: true } });
  const parties = new Set(c.signatures.map((s) => s.party));
  if (!(parties.has("CLIENTE") && parties.has("EMPRESA"))) return c;
  const updated = await tx.contract.update({
    where: { id: contractId },
    data: { status: c.rental && c.rental.departedAt ? "ATIVO" : "ASSINADO", signedAt: new Date(), signTokenHash: null, signTokenExpiresAt: null },
  });
  if (c.rental && c.rental.status === "RESERVADA") {
    await tx.rental.update({ where: { id: c.rental.id }, data: { status: "CONFIRMADA" } });
  }
  await audit(tx, { userId: actorId, action: "contract.signed", entityType: "Contract", entityId: contractId, summary: `Contrato #${seq(c.number)} assinado pelas duas partes` });
  return updated;
}

async function addSignature(tx: Db, contractId: string, data: Omit<Prisma.ContractSignatureUncheckedCreateInput, "contractId">, actorId: string | null) {
  const c = await lockContract(tx, contractId);
  if (!CONTRACT_OPEN_STATUSES.includes(c.status as ContractStatus)) throw new DomainError("Este contrato não aceita mais assinaturas.");
  if (c.signatures.some((s) => s.party === data.party)) {
    throw new DomainError(data.party === "CLIENTE" ? "O cliente já assinou este contrato." : "A empresa já assinou este contrato.");
  }
  await tx.contractSignature.create({ data: { ...data, contractId } });
  await audit(tx, {
    userId: actorId,
    action: "contract.signature",
    entityType: "Contract",
    entityId: contractId,
    summary: `Assinatura ${data.party === "CLIENTE" ? "do cliente" : "da empresa"} (${data.signerName}) no contrato #${seq(c.number)}`,
  });
  return completeIfSigned(tx, contractId, actorId);
}

/** Assinatura colhida no próprio sistema (tablet/celular da empresa). */
export async function signContractInPerson(db: PrismaClient, actor: Actor, contractId: string, input: SignatureInput) {
  assertCan(actor, "contract.manage");
  if (!input.signerName.trim()) throw new DomainError("Informe o nome de quem assina.");
  validateSignatureImage(input.imagePng);
  return withTx(db, (tx) =>
    addSignature(
      tx,
      contractId,
      {
        party: input.party,
        method: "DIGITAL",
        signerName: input.signerName.trim(),
        signerDocument: input.signerDocument?.trim() || null,
        imageData: new Uint8Array(input.imagePng),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        collectedById: actor.id,
      },
      actor.id,
    ),
  );
}

/** Assinatura do cliente pelo link recebido no WhatsApp (sem login). */
export async function signContractByToken(db: PrismaClient, token: string, input: Omit<SignatureInput, "party">) {
  if (!input.signerName.trim()) throw new DomainError("Informe seu nome completo.");
  validateSignatureImage(input.imagePng);
  return withTx(db, async (tx) => {
    const c = await findContractByToken(tx, token);
    if (!c) throw new DomainError("Link de assinatura inválido ou expirado. Peça um novo link à Universo Tendas.");
    return addSignature(
      tx,
      c.id,
      {
        party: "CLIENTE",
        method: "DIGITAL",
        signerName: input.signerName.trim(),
        signerDocument: input.signerDocument?.trim() || null,
        imageData: new Uint8Array(input.imagePng),
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
      null,
    );
  });
}

/** Contrato impresso e assinado à mão: guarda o arquivo digitalizado e registra as duas assinaturas. */
export async function registerManualSignature(
  db: PrismaClient,
  actor: Actor,
  contractId: string,
  input: { file: Buffer; mime: string; fileName: string; clientName: string },
) {
  assertCan(actor, "contract.manage");
  if (!input.clientName.trim()) throw new DomainError("Informe o nome do cliente que assinou.");
  if (input.file.length > 4 * 1024 * 1024) throw new DomainError("Arquivo muito grande (máx. 4 MB).");
  return withTx(db, async (tx) => {
    const c = await lockContract(tx, contractId);
    if (!CONTRACT_OPEN_STATUSES.includes(c.status as ContractStatus)) throw new DomainError("Este contrato não aceita mais assinaturas.");
    const doc = await tx.document.create({
      data: {
        kind: "CONTRATO_ASSINADO",
        title: `Contrato #${seq(c.number)} assinado (digitalizado)`,
        fileName: input.fileName.slice(0, 120),
        mime: input.mime,
        size: input.file.length,
        data: new Uint8Array(input.file),
        customerId: c.customerId,
        rentalId: c.rentalId,
        contractId: c.id,
        uploadedById: actor.id,
      },
    });
    const parties = new Set(c.signatures.map((s) => s.party));
    for (const party of ["CLIENTE", "EMPRESA"] as const) {
      if (parties.has(party)) continue;
      await tx.contractSignature.create({
        data: {
          contractId: c.id,
          party,
          method: "MANUAL",
          signerName: party === "CLIENTE" ? input.clientName.trim() : actor.name,
          documentId: doc.id,
          collectedById: actor.id,
        },
      });
    }
    await audit(tx, { userId: actor.id, action: "contract.manual_signature", entityType: "Contract", entityId: c.id, summary: `Anexou o contrato #${seq(c.number)} assinado em papel` });
    return completeIfSigned(tx, c.id, actor.id);
  });
}

export async function cancelContract(db: PrismaClient, actor: Actor, contractId: string, reason: string) {
  assertCan(actor, "contract.cancel");
  if (!reason.trim()) throw new DomainError("Informe o motivo do cancelamento.");
  return withTx(db, async (tx) => {
    const c = await lockContract(tx, contractId);
    if (c.status === "CANCELADO" || c.status === "FINALIZADO") throw new DomainError("Este contrato já está encerrado.");
    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status: "CANCELADO", canceledAt: new Date(), cancelReason: reason.trim(), signTokenHash: null, signTokenExpiresAt: null },
    });
    await audit(tx, { userId: actor.id, action: "contract.cancel", entityType: "Contract", entityId: contractId, summary: `Cancelou o contrato #${seq(c.number)}: ${reason.trim()}` });
    return updated;
  });
}

