import { modelView } from "@/lib/model-view";
import { publicPhotoUrl } from "@/lib/public-urls";
import { productPath, productPhotos, type PublicProduct } from "./public-booking";

/** Formato público do produto: só o que foi cadastrado, sem contadores internos nem custos. */
export function serializeProduct(p: PublicProduct) {
  const model = modelView(p.id, p.model3d);
  return {
    id: p.id,
    slug: p.slug ?? p.id,
    path: productPath(p),
    name: p.name,
    code: p.sku,
    category: p.category,
    kind: p.kind,
    description: p.description,
    dimensions: p.dimensions,
    unit: p.unit,
    /** null = sem preço cadastrado ("Valor a consultar"). */
    rentalPriceCents: p.rentalPriceCents,
    photos: productPhotos(p).map((id) => ({ id, url: publicPhotoUrl(id), thumb: publicPhotoUrl(id, true) })),
    model3d: model && p.model3d ? { url: `/api/public/models/${p.slug ?? p.id}?v=${p.model3d.updatedAt.getTime().toString(36)}`, settings: model.settings } : null,
  };
}

export { publicPhotoUrl };

export type SerializedProduct = ReturnType<typeof serializeProduct>;
