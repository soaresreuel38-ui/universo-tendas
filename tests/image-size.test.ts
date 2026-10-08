import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { imageSize } from "@/server/image-size";

/** Leitura de largura × altura usada para decidir o modo do hero (foto em tela cheia ou foto de catálogo). */
describe("imageSize", () => {
  const make = (fmt: "jpeg" | "png" | "webp", w: number, h: number, lossless = false) =>
    sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
      [fmt](fmt === "webp" ? { lossless } : {})
      .toBuffer();

  it("lê JPEG, PNG e WebP (com e sem perdas)", async () => {
    expect(imageSize(await make("jpeg", 1920, 1080))).toEqual({ width: 1920, height: 1080 });
    expect(imageSize(await make("png", 470, 380))).toEqual({ width: 470, height: 380 });
    expect(imageSize(await make("webp", 470, 380))).toEqual({ width: 470, height: 380 });
    expect(imageSize(await make("webp", 2400, 1600, true))).toEqual({ width: 2400, height: 1600 });
  });

  it("recusa arquivo que não é imagem", () => {
    expect(imageSize(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31]))).toBeNull();
  });
});
