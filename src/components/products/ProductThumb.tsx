import { ProductImage } from "./ProductImage";

export function ProductThumb({ photoId, name, size = "sm" }: { photoId: string | null; name: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-28 w-28 md:h-36 md:w-36" : "h-11 w-11";
  return (
    <span className={`${cls} inline-block shrink-0 overflow-hidden rounded-lg border border-line`}>
      <ProductImage photoId={photoId} name={name} size="thumb" />
    </span>
  );
}
