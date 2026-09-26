import { beforeEach, describe, expect, it } from "vitest";
import { detectModel, removeProductModel, saveProductModel, updateModelView } from "@/server/catalog";
import { makeTestTentGlb } from "./fixtures/tent-glb";
import { db, makeProduct, makeUsers, resetDb } from "./helpers";

let users: Awaited<ReturnType<typeof makeUsers>>;
beforeEach(async () => {
  await resetDb();
  users = await makeUsers();
});

describe("modelo 3D do produto", () => {
  it("aceita GLB válido, guarda câmera/escala/rotação e permite remover", async () => {
    const glb = Buffer.from(await makeTestTentGlb());
    expect(detectModel(glb, "tenda.glb").mime).toBe("model/gltf-binary");
    const p = await makeProduct(users.admin);
    await saveProductModel(db, users.admin, p.id, { data: glb, size: glb.length, fileName: "tenda.glb" });
    await updateModelView(db, users.admin, p.id, { cameraPosition: [5, 3, 5], cameraTarget: [0, 1, 0], scale: 1.5, rotationY: 45 });
    const m = await db.productModel3D.findUniqueOrThrow({ where: { productId: p.id } });
    expect(m).toMatchObject({ scale: 1.5, rotationY: 45, cameraPosition: [5, 3, 5], mime: "model/gltf-binary" });
    await removeProductModel(db, users.admin, p.id);
    expect(await db.productModel3D.count()).toBe(0);
  });

  it("recusa arquivo que não é modelo, gltf com arquivos externos e funcionário", async () => {
    expect(() => detectModel(Buffer.from("<html>"), "x.glb")).toThrow(/Formato não suportado/);
    const ext = Buffer.from(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: "tenda.bin" }] }));
    expect(() => detectModel(ext, "x.gltf")).toThrow(/arquivos externos/);
    const p = await makeProduct(users.admin);
    const glb = Buffer.from(await makeTestTentGlb());
    await expect(saveProductModel(db, users.employee, p.id, { data: glb, size: glb.length, fileName: "t.glb" })).rejects.toThrow(/permissão/);
  });
});
