/* eslint-disable @next/next/no-img-element */
import { ProductPlaceholder } from "@/components/products/ProductImage";
import { publicPhotoUrl } from "@/lib/public-urls";

/**
 * Foto real cadastrada no painel (rota pública que só serve fotos de produtos visíveis no site).
 * Sem foto: o desenho técnico da marca com "Foto a cadastrar" — nunca uma imagem de banco de imagens.
 */
export function Photo({
  id,
  alt,
  size = "full",
  className = "",
  priority = false,
  sizes,
}: {
  id: string | null | undefined;
  alt: string;
  size?: "thumb" | "full";
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  if (!id) return <ProductPlaceholder name={alt} className={className} />;
  return (
    <img
      src={publicPhotoUrl(id, size === "thumb")}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      sizes={sizes}
      className={`h-full w-full bg-sand object-cover ${className}`}
    />
  );
}
