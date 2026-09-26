import type { ModelViewSettings } from "@/components/three/ModelViewer";

type ModelRow = {
  updatedAt: Date;
  cameraPosition: unknown;
  cameraTarget: unknown;
  scale: number;
  rotationY: number;
};

/** URL (com versão para cache) e apresentação inicial do modelo 3D de um produto. */
export function modelView(productId: string, m: ModelRow | null | undefined): { url: string; settings: ModelViewSettings } | null {
  if (!m) return null;
  return {
    url: `/api/modelos/${productId}?v=${m.updatedAt.getTime().toString(36)}`,
    settings: {
      cameraPosition: (m.cameraPosition as [number, number, number] | null) ?? null,
      cameraTarget: (m.cameraTarget as [number, number, number] | null) ?? null,
      scale: m.scale,
      rotationY: m.rotationY,
    },
  };
}
