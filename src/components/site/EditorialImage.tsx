/* eslint-disable @next/next/no-img-element */
import { editorialSrc, editorialSrcSet, type EditorialPhoto } from "@/lib/editorial-photos";

/** Foto real da empresa (do Instagram, servida pelo próprio site) em tamanho responsivo. */
export function EditorialImage({
  photo,
  sizes,
  priority = false,
  className = "",
  imgClassName = "",
  decorative = false,
}: {
  photo: EditorialPhoto;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  decorative?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={editorialSrc(photo)}
        srcSet={editorialSrcSet(photo)}
        sizes={sizes}
        alt={decorative ? "" : photo.alt}
        width={photo.width}
        height={photo.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        style={{ ["--fp" as string]: photo.focus ?? "50% 50%", ["--fpm" as string]: photo.mobileFocus ?? photo.focus ?? "50% 50%" }}
        className={`h-full w-full object-cover [object-position:var(--fpm)] sm:[object-position:var(--fp)] ${imgClassName}`}
      />
    </div>
  );
}
