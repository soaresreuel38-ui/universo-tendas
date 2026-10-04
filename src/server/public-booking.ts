import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { bookingWindow, canRequestCancel, checkEventDates, eventDays, eventMoments } from "@/lib/booking";
import { formatCep, formatCnpj, formatCpf, formatPhone, isValidCnpj, isValidCpf, normalizePhone, UF_LIST } from "@/lib/br-documents";
import { onlyDigits, seq } from "@/lib/format";
import type { RentalStatus } from "@/lib/domain";
import { zText } from "@/lib/validation";
import { availabilityForPeriod } from "./availability";
import { audit } from "./audit";
import { sha256 } from "./contracts";
import { DomainError, type Db } from "./errors";
import { insertRentalInTx } from "./rentals";
import { withTx } from "./stock";

/**
 * Site público → mesmo backend do painel.
 *
 * Nada aqui calcula estoque por conta própria: a disponibilidade vem de availabilityForPeriod()
 * e a criação passa por insertRentalInTx(), que trava os produtos (SELECT … FOR UPDATE) e
 * revalida com assertBookable() — exatamente o caminho de uma locação criada no painel.
 * Preços nunca vêm do navegador: são lidos do cadastro do produto.
 */

// ───────────────────────── Catálogo público ─────────────────────────

/** Produtos que podem aparecer no site: ativos, de locação e marcados como visíveis. */
export const PUBLIC_PRODUCT_WHERE = {
  active: true,
  showOnSite: true,
  kind: { in: ["RENTAL", "BOTH"] },
} satisfies Prisma.ProductWhereInput;

const publicSelect = {
  id: true,
  slug: true,
  name: true,
  sku: true,
  category: true,
  kind: true,
  description: true,
  dimensions: true,
  unit: true,
  rentalPriceCents: true,
  photoId: true,
  featured: true,
  updatedAt: true,
  images: { select: { photoId: true }, orderBy: { sortOrder: "asc" } },
  model3d: { select: { updatedAt: true, cameraPosition: true, cameraTarget: true, scale: true, rotationY: true } },
} satisfies Prisma.ProductSelect;

export type PublicProduct = Prisma.ProductGetPayload<{ select: typeof publicSelect }>;

/** Caminho público do produto: /tendas/<slug> (ou o id enquanto o slug não foi definido). */
export const productPath = (p: { slug: string | null; id: string }) => `/tendas/${p.slug ?? p.id}`;

/** Fotos do produto na ordem de exibição: principal primeiro, depois a galeria. */
export function productPhotos(p: { photoId: string | null; images: Array<{ photoId: string }> }): string[] {
  const ids = [...(p.photoId ? [p.photoId] : []), ...p.images.map((i) => i.photoId)];
  return [...new Set(ids)];
}

export async function listPublicProducts(db: PrismaClient | Db, filter: { category?: string | null } = {}) {
  return db.product.findMany({
    where: { ...PUBLIC_PRODUCT_WHERE, ...(filter.category ? { category: filter.category } : {}) },
    select: publicSelect,
    orderBy: [{ featured: "desc" }, { category: "asc" }, { name: "asc" }],
  });
}

export async function findPublicProduct(db: PrismaClient | Db, slugOrId: string) {
  if (!/^[a-z0-9-]{1,80}$/i.test(slugOrId)) return null;
  return db.product.findFirst({
    where: { ...PUBLIC_PRODUCT_WHERE, OR: [{ slug: slugOrId.toLowerCase() }, { id: slugOrId }] },
    select: publicSelect,
  });
}

/** Uma foto só é servida publicamente se pertence a um produto visível no site. */
export async function isPublicPhoto(db: PrismaClient | Db, photoId: string) {
  const n = await db.product.count({
    where: { ...PUBLIC_PRODUCT_WHERE, OR: [{ photoId }, { images: { some: { photoId } } }] },
  });
  return n > 0;
}

// ───────────────────────── Disponibilidade (mesma regra do painel) ─────────────────────────

export async function bookingSettings(db: PrismaClient | Db) {
  const s = await db.businessSettings.findUnique({ where: { id: "default" } });
  return {
    enabled: s?.onlineBookingEnabled ?? true,
    autoConfirm: s?.onlineAutoConfirm ?? false,
    daysBefore: s?.onlineBufferDaysBefore ?? 1,
    daysAfter: s?.onlineBufferDaysAfter ?? 1,
  };
}

/**
 * Quanto está livre para o evento informado, já considerando a margem operacional.
 * Retorna também o período bloqueado (para mostrar ao cliente com transparência).
 */
export async function publicAvailability(
  db: PrismaClient | Db,
  productIds: string[],
  eventStart: string,
  eventEnd: string,
  now: Date = new Date(),
) {
  const error = checkEventDates(eventStart, eventEnd, { now });
  if (error) throw new DomainError(error);
  const settings = await bookingSettings(db);
  const visible = await db.product.findMany({ where: { ...PUBLIC_PRODUCT_WHERE, id: { in: productIds } }, select: { id: true } });
  const window = bookingWindow(eventStart, eventEnd, settings.daysBefore, settings.daysAfter);
  const map = await availabilityForPeriod(db, visible.map((p) => p.id), window.departureAt, window.expectedReturnAt, { now });
  const free: Record<string, number> = {};
  for (const [id, a] of map) free[id] = a.free;
  return { free, window };
}

// ───────────────────────── Criar reserva ─────────────────────────

const optText = (max: number) =>
  z
    .string()
    .optional()
    .default("")
    .transform((v) => v)
    .pipe(zText(max))
    .transform((v) => (v === "" ? null : v));
const reqText = (max: number, message: string) =>
  z
    .string({ message })
    .pipe(zText(max))
    .refine((v) => v.length > 0, message);

export const reservationSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().regex(/^[a-z0-9]{1,40}$/i, "Produto inválido."),
          quantity: z.number({ message: "Quantidade inválida." }).int("Quantidade inválida.").min(1, "Escolha ao menos 1 unidade.").max(10_000),
        }),
      )
      .min(1, "Escolha uma tenda.")
      .max(20),
    eventStart: z.string(),
    eventEnd: z.string(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    eventName: optText(120),
    address: z.object({
      zipCode: z.string().transform(onlyDigits).refine((v) => v.length === 8, "CEP inválido."),
      street: reqText(200, "Informe o endereço."),
      number: reqText(20, "Informe o número (ou S/N)."),
      complement: optText(120),
      district: reqText(120, "Informe o bairro."),
      city: reqText(120, "Informe a cidade."),
      state: z.string().trim().toUpperCase().refine((v) => (UF_LIST as readonly string[]).includes(v), "Estado inválido."),
      notes: optText(1000),
    }),
    customer: z.discriminatedUnion("personType", [
      z.object({
        personType: z.literal("PF"),
        name: reqText(120, "Informe seu nome completo."),
        document: z.string().refine(isValidCpf, "CPF inválido."),
        whatsapp: z.string(),
        email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
      }),
      z.object({
        personType: z.literal("PJ"),
        name: reqText(160, "Informe a razão social."),
        tradeName: optText(160),
        contactName: reqText(120, "Informe o nome do responsável."),
        document: z.string().refine(isValidCnpj, "CNPJ inválido."),
        whatsapp: z.string(),
        email: z.string().trim().toLowerCase().email("E-mail inválido.").max(160),
      }),
    ]),
  })
  .superRefine((v, ctx) => {
    const err = checkEventDates(v.eventStart, v.eventEnd, { startTime: v.startTime, endTime: v.endTime });
    if (err) ctx.addIssue({ code: "custom", message: err, path: ["eventStart"] });
    if (!normalizePhone(v.customer.whatsapp)) ctx.addIssue({ code: "custom", message: "WhatsApp inválido. Use DDD + número.", path: ["customer", "whatsapp"] });
    const ids = v.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Há tendas repetidas no pedido.", path: ["items"] });
  });

export type ReservationRequest = z.input<typeof reservationSchema>;

export function formatEventAddress(a: { street: string; number: string; complement: string | null; district: string; city: string; state: string; zipCode: string }) {
  return `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ""} — ${a.district}, ${a.city}/${a.state} — CEP ${formatCep(a.zipCode)}`;
}

/** Encontra o cliente pelo CPF/CNPJ (com ou sem pontuação) ou cria um novo. Não sobrescreve dados já cadastrados. */
async function findOrCreateCustomer(tx: Db, c: z.output<typeof reservationSchema>["customer"]) {
  const digits = onlyDigits(c.document);
  const formatted = c.personType === "PF" ? formatCpf(digits) : formatCnpj(digits);
  const phone = normalizePhone(c.whatsapp)!;
  const existing = await tx.customer.findFirst({ where: { document: { in: [digits, formatted] } }, orderBy: { createdAt: "asc" } });
  if (existing) {
    await tx.customer.update({
      where: { id: existing.id },
      data: {
        active: true,
        whatsapp: existing.whatsapp ?? formatPhone(phone),
        phone: existing.phone ?? formatPhone(phone),
        email: existing.email ?? c.email,
        ...(c.personType === "PJ"
          ? { tradeName: existing.tradeName ?? c.tradeName, contactName: existing.contactName ?? c.contactName }
          : {}),
      },
    });
    return existing;
  }
  return tx.customer.create({
    data: {
      personType: c.personType,
      name: c.name,
      tradeName: c.personType === "PJ" ? c.tradeName : null,
      contactName: c.personType === "PJ" ? c.contactName : null,
      document: formatted,
      phone: formatPhone(phone),
      whatsapp: formatPhone(phone),
      email: c.email,
    },
  });
}

/** Token do link "minha reserva": aleatório, mostrado uma única vez; só o hash fica no banco. */
export const newPublicToken = () => randomBytes(24).toString("base64url");

export async function createOnlineReservation(db: PrismaClient, raw: unknown) {
  const input = reservationSchema.parse(raw);
  const settings = await bookingSettings(db);
  if (!settings.enabled) throw new DomainError("As reservas pelo site estão pausadas no momento. Fale com a gente pelo WhatsApp.");

  const window = bookingWindow(input.eventStart, input.eventEnd, settings.daysBefore, settings.daysAfter);
  const moments = eventMoments(input.eventStart, input.eventEnd, input.startTime, input.endTime);
  const token = newPublicToken();
  const days = eventDays(input.eventStart, input.eventEnd);

  const rental = await withTx(db, async (tx) => {
    // Preço sempre do cadastro (nunca do navegador). Produto fora do site não pode ser reservado por aqui.
    const products = await tx.product.findMany({
      where: { ...PUBLIC_PRODUCT_WHERE, id: { in: input.items.map((i) => i.productId) } },
      select: { id: true, name: true, rentalPriceCents: true },
    });
    if (products.length !== input.items.length) throw new DomainError("Uma das tendas escolhidas não está mais disponível no site.");
    const items = input.items.map((i) => {
      const p = products.find((x) => x.id === i.productId)!;
      // Valor por unidade = diária × dias do evento (mesma regra de preço por diária do painel).
      return { productId: p.id, quantity: i.quantity, unitPriceCents: (p.rentalPriceCents ?? 0) * days };
    });
    const pricePending = products.some((p) => p.rentalPriceCents == null);

    const customer = await findOrCreateCustomer(tx, input.customer);
    const a = input.address;
    const contact = [
      `Contato informado no site: ${input.customer.name}`,
      input.customer.personType === "PJ" ? `responsável ${input.customer.contactName}` : null,
      `WhatsApp ${formatPhone(input.customer.whatsapp)}`,
      input.customer.email,
    ]
      .filter(Boolean)
      .join(" · ");

    // Mesmo núcleo do painel: trava + assertBookable no período operacional.
    return insertRentalInTx(
      tx,
      {
        customerId: customer.id,
        eventName: input.eventName ?? `Evento em ${a.city}`,
        eventAddress: formatEventAddress(a),
        eventZipCode: formatCep(a.zipCode),
        eventStreet: a.street,
        eventNumber: a.number,
        eventComplement: a.complement,
        eventDistrict: a.district,
        eventCity: a.city,
        eventState: a.state,
        eventNotes: a.notes,
        eventAt: moments.eventAt,
        eventEndAt: moments.eventEndAt,
        departureAt: window.departureAt,
        expectedReturnAt: window.expectedReturnAt,
        notes: contact,
        billingMode: "DIARIA",
        periodCount: days,
        items,
        status: settings.autoConfirm ? "CONFIRMADA" : "RESERVADA",
      },
      { createdById: null, source: "SITE", pricePending, publicTokenHash: sha256(token) },
    );
  });
  return { id: rental.id, number: rental.number, code: seq(rental.number), token, status: rental.status as RentalStatus };
}

// ───────────────────────── Consulta e pedido de cancelamento ─────────────────────────

const publicRentalInclude = {
  customer: { select: { name: true, personType: true, tradeName: true, phone: true, whatsapp: true } },
  items: { select: { quantity: true, unitPriceCents: true, product: { select: { id: true, slug: true, name: true, sku: true, unit: true, photoId: true } } } },
  contracts: { select: { number: true, status: true, signedAt: true }, where: { status: { not: "CANCELADO" } }, orderBy: { number: "desc" }, take: 1 },
  payments: { select: { amountCents: true } },
} satisfies Prisma.RentalInclude;

export type PublicRental = Prisma.RentalGetPayload<{ include: typeof publicRentalInclude }>;

/** Acesso pelo link com token (enviado só para quem fez a reserva). */
export async function findRentalByToken(db: PrismaClient | Db, token: string): Promise<PublicRental | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return db.rental.findUnique({ where: { publicTokenHash: sha256(token) }, include: publicRentalInclude });
}

/** Acesso pelo número da reserva + telefone/WhatsApp do cliente (os dois precisam bater). */
export async function findRentalByCode(db: PrismaClient | Db, code: string, phone: string): Promise<PublicRental | null> {
  const number = Number(onlyDigits(code));
  const p = normalizePhone(phone);
  if (!Number.isSafeInteger(number) || number <= 0 || !p) return null;
  const rental = await db.rental.findUnique({ where: { number }, include: publicRentalInclude });
  if (!rental) return null;
  const known = [rental.customer.phone, rental.customer.whatsapp].map((x) => normalizePhone(x ?? ""));
  return known.includes(p) ? rental : null;
}

/** Como o cliente identifica a reserva: link com token, ou número + telefone. */
export const rentalRefSchema = z.union([
  z.object({ token: z.string().max(80) }),
  z.object({ code: z.string().max(20), phone: z.string().max(30) }),
]);

export function findRentalByRef(db: PrismaClient | Db, ref: z.output<typeof rentalRefSchema>) {
  return "token" in ref ? findRentalByToken(db, ref.token) : findRentalByCode(db, ref.code, ref.phone);
}

/** O cliente só PEDE o cancelamento; quem cancela (e libera o estoque) é a empresa, no painel. */
export async function requestCancellation(db: PrismaClient, rentalId: string, reason: string | null) {
  return withTx(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Rental" WHERE id = ${rentalId} FOR UPDATE`;
    const r = await tx.rental.findUnique({ where: { id: rentalId } });
    if (!r) throw new DomainError("Reserva não encontrada.");
    if (!canRequestCancel(r.status as RentalStatus)) throw new DomainError("Esta reserva não pode mais ser cancelada pelo site. Fale com a gente pelo WhatsApp.");
    if (r.cancelRequestedAt) return r;
    await audit(tx, {
      userId: null,
      action: "rental.cancel_requested",
      entityType: "Rental",
      entityId: r.id,
      summary: `Cliente pediu pelo site o cancelamento da locação #${seq(r.number)}${reason ? `: ${reason}` : ""}`,
    });
    return tx.rental.update({ where: { id: r.id }, data: { cancelRequestedAt: new Date(), cancelRequestReason: reason?.slice(0, 1000) ?? null } });
  });
}
