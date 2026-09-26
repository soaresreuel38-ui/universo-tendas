/**
 * Gera um GLB simples de tenda piramidal, usado apenas nos testes automáticos do visualizador 3D.
 * Não é um modelo de produto real da empresa.
 */
import { Document, NodeIO } from "@gltf-transform/core";

export async function makeTestTentGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  // Base 4x4 (y=0 a 2.2 paredes) e cume em y=3.4
  const h = 2, wall = 2.2, top = 3.4;
  const pos = [
    -h, 0, -h, h, 0, -h, h, wall, -h, -h, wall, -h, // frente
    h, 0, h, -h, 0, h, -h, wall, h, h, wall, h, // trás
    -h, 0, h, -h, 0, -h, -h, wall, -h, -h, wall, h, // esquerda
    h, 0, -h, h, 0, h, h, wall, h, h, wall, -h, // direita
    -h, wall, -h, h, wall, -h, 0, top, 0, // telhado
    h, wall, -h, h, wall, h, 0, top, 0,
    h, wall, h, -h, wall, h, 0, top, 0,
    -h, wall, h, -h, wall, -h, 0, top, 0,
  ];
  const idx: number[] = [];
  for (let q = 0; q < 4; q++) { const b = q * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  for (let t = 0; t < 4; t++) { const b = 16 + t * 3; idx.push(b, b + 1, b + 2); }
  const position = doc.createAccessor().setType("VEC3").setArray(new Float32Array(pos)).setBuffer(buffer);
  const indices = doc.createAccessor().setType("SCALAR").setArray(new Uint16Array(idx)).setBuffer(buffer);
  const material = doc.createMaterial("lona").setBaseColorFactor([0.95, 0.96, 0.98, 1]).setRoughnessFactor(0.7).setDoubleSided(true);
  const prim = doc.createPrimitive().setAttribute("POSITION", position).setIndices(indices).setMaterial(material);
  const mesh = doc.createMesh("tenda").addPrimitive(prim);
  doc.createScene("cena").addChild(doc.createNode("tenda").setMesh(mesh));
  return new NodeIO().writeBinary(doc);
}

