/* eslint-disable @next/next/no-img-element */
import { editorialSrc, editorialSrcSet, type EditorialPhoto } from "@/lib/editorial-photos";

/**
 * Fotografia ilustrativa em tamanho responsivo (srcset do CDN) com o selo "Imagem ilustrativa",
 * para que nenhuma foto de banco de imagens seja confundida com um trabalho da empresa.
 */
export function EditorialImage({
  photo,
  sizes,
  priority = false,
  className = "",
  imgClassName = "",
  label = true,
  labelTone = "light",
  labelPosition = "bottom-left",
  decorative = false,
}: {
  photo: EditorialPhoto;
  sizes: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  label?: boolean;
  labelTone?: "light" | "dark";
  labelPosition?: "bottom-left" | "bottom-right" | "top-right";
  decorative?: boolean;
}) {
  const pos = { "bottom-left": "bottom-3 left-3", "bottom-right": "bottom-3 right-3", "top-right": "top-3 right-3" }[labelPosition];
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={editorialSrc(photo, 1440)}
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
      {label ? (
        <span
          className={`pointer-events-none absolute ${pos} rounded-[2px] px-2 py-1 text-[11px] leading-none ${
            labelTone === "light" ? "bg-black/35 text-white/85 backdrop-blur-sm" : "bg-white/80 text-tinta/70"
          }`}
        >
          Imagem ilustrativa
        </span>
      ) : null}
    </div>
  );
}
