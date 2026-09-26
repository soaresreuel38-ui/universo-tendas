import type { PrismaClient } from "@prisma/client";
import { audit } from "./audit";
import { assertCan, DomainError, type Actor } from "./errors";
import { withTx } from "./stock";

export const MODEL_MAX_DB_BYTES = 4 * 1024 * 1024;

// ───────────────────────── Galeria ─────────────────────────

export async function addProductImages(db: PrismaClient, actor: Actor, productId: string, photoIds: string[]) {
  assertCan(actor, "product.manage");
  if (photoIds.length === 0) return;
  return withTx(db, async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId }, include: { images: true } });
    if (!product) throw new DomainError("Produto não encontrado.");
    const photos = await tx.photo.findMany({ where: { id: { in: photoIds } }, select: { id: true } });
    let order = product.images.reduce((m, i) => Math.max(m, i.sortOrder), 0);
    for (const p of photos) {
      if (product.images.some((i) => i.photoId === p.id)) continue;
      await tx.productImage.create({ data: { productId, photoId: p.id, sortOrder: ++order } });
    }
    if (!product.photoId && photos[0]) await tx.product.update({ where: { id: productId }, data: { photoId: photos[0].id } });
    await audit(tx, { userId: actor.id, action: "product.images", entityType: "Product", entityId: productId, summary: `Adicionou ${photos.length} foto(s) em ${product.name}` });
  });
}

export async function removeProductImage(db: PrismaClient, actor: Actor, productId: string, photoId: string) {
  assertCan(actor, "product.manage");
  return withTx(db, async (tx) => {
    await tx.productImage.deleteMany({ where: { productId, photoId } });
    const p = await tx.product.findUniqueOrThrow({ where: { id: productId }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    if (p.photoId === photoId) await tx.product.update({ where: { id: productId }, data: { photoId: p.images[0]?.photoId ?? null } });
  });
}

export async function setMainImage(db: PrismaClient, actor: Actor, productId: string, photoId: string) {
  assertCan(actor, "product.manage");
  const img = await db.productImage.findUnique({ where: { productId_photoId: { productId, photoId } } });
  if (!img) throw new DomainError("Foto não pertence a este produto.");
  await db.product.update({ where: { id: productId }, data: { photoId } });
}

// ───────────────────────── Modelo 3D ─────────────────────────

/** Confere se o arquivo é realmente um GLB (binário) ou GLTF autocontido. */
export function detectModel(buf: Buffer, fileName: string): { mime: string } {
  if (buf.length >= 12 && buf.readUInt32LE(0) === 0x46546c67 /* "glTF" */ && buf.readUInt32LE(4) === 2) {
    return { mime: "model/gltf-binary" };
  }
  if (/\.gltf$/i.test(fileName)) {
    let json: { asset?: { version?: string }; buffers?: Array<{ uri?: string }>; images?: Array<{ uri?: string }> };
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch {
      throw new DomainError("Arquivo .gltf inválido.");
    }
    if (!json.asset?.version?.startsWith("2")) throw new DomainError("Somente glTF 2.0 é suportado.");
    const external = [...(json.buffers ?? []), ...(json.images ?? [])].some((b) => b.uri && !b.uri.startsWith("data:"));
    if (external) throw new DomainError("Este .gltf depende de arquivos externos. Exporte como .glb (arquivo único).");
    return { mime: "model/gltf+json" };
  }
  throw new DomainError("Formato não suportado. Envie um arquivo .glb (recomendado) ou .gltf.");
}

export async function saveProductModel(
  db: PrismaClient,
  actor: Actor,
  productId: string,
  file: { data?: Buffer; blobUrl?: string; size: number; fileName: string; mime?: string },
) {
  assertCan(actor, "product.manage");
  let mime = file.mime ?? "model/gltf-binary";
  if (file.data) {
    if (file.data.length > MODEL_MAX_DB_BYTES) {
      throw new DomainError("Modelo com mais de 4 MB. Otimize o arquivo (ex.: gltf.report / gltf-transform) ou configure o armazenamento Vercel Blob.");
    }
    mime = detectModel(file.data, file.fileName).mime;
  } else if (!file.blobUrl) {
    throw new DomainError("Envie o arquivo do modelo.");
  }
  return withTx(db, async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new DomainError("Produto não encontrado.");
    const data = {
      fileName: file.fileName.slice(0, 120),
      mime,
      size: file.size,
      data: file.data ? new Uint8Array(file.data) : null,
      blobUrl: file.blobUrl ?? null,
      uploadedById: actor.id,
    };
    const model = await tx.productModel3D.upsert({
      where: { productId },
      create: { productId, ...data },
      update: { ...data, cameraPosition: undefined },
    });
    await audit(tx, { userId: actor.id, action: "product.model3d", entityType: "Product", entityId: productId, summary: `Enviou o modelo 3D de ${product.name} (${file.fileName})` });
    return model;
  });
}

export type ModelView = { cameraPosition: [number, number, number] | null; cameraTarget: [number, number, number] | null; scale: number; rotationY: number };

export async function updateModelView(db: PrismaClient, actor: Actor, productId: string, view: ModelView) {
  assertCan(actor, "product.manage");
  if (!(view.scale > 0 && view.scale <= 100)) throw new DomainError("Escala inválida.");
  if (!(view.rotationY >= -360 && view.rotationY <= 360)) throw new DomainError("Rotação inválida.");
  const ok = (v: unknown) => v === null || (Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n) && Math.abs(n) < 10_000));
  if (!ok(view.cameraPosition) || !ok(view.cameraTarget)) throw new DomainError("Posição de câmera inválida.");
  const model = await db.productModel3D.findUnique({ where: { productId } });
  if (!model) throw new DomainError("Este produto não tem modelo 3D.");
  return db.productModel3D.update({
    where: { productId },
    data: {
      scale: view.scale,
      rotationY: view.rotationY,
      cameraPosition: view.cameraPosition ?? undefined,
      cameraTarget: view.cameraTarget ?? undefined,
    },
  });
}

export async function removeProductModel(db: PrismaClient, actor: Actor, productId: string) {
  assertCan(actor, "product.manage");
  return withTx(db, async (tx) => {
    const deleted = await tx.productModel3D.deleteMany({ where: { productId } });
    if (deleted.count) await audit(tx, { userId: actor.id, action: "product.model3d_remove", entityType: "Product", entityId: productId, summary: "Removeu o modelo 3D" });
  });
}
