"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ProductPlaceholder } from "@/components/products/ProductImage";
import { publicPhotoUrl } from "@/lib/public-urls";

/**
 * Galeria de fotos reais do produto. No celular: deslizar (scroll-snap). Miniaturas carregadas
 * primeiro; a foto grande só é baixada quando aparece. Toque/clique abre em tela cheia.
 */
export function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (zoom == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
      if (e.key === "ArrowRight") setZoom((z) => (z == null ? z : (z + 1) % photos.length));
      if (e.key === "ArrowLeft") setZoom((z) => (z == null ? z : (z - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoom, photos.length]);

  const go = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  if (photos.length === 0) {
    return (
      <div className="aspect-[4/3] overflow-hidden">
        <ProductPlaceholder name={name} />
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <div ref={track} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto bg-sand" aria-label={`Fotos de ${name}`}>
          {photos.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => setZoom(i)}
              className="relative aspect-[4/3] w-full shrink-0 snap-center cursor-zoom-in bg-sand lg:aspect-[16/9]"
              aria-label={`Ampliar foto ${i + 1} de ${photos.length}`}
            >
              <img src={publicPhotoUrl(id, true)} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-105 object-cover blur-md" />
              <img
                src={publicPhotoUrl(id)}
                alt={`${name} — foto ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                className="relative h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
        {photos.length > 1 ? (
          <span className="pointer-events-none absolute bottom-0 right-0 bg-white px-3 py-1.5 text-[13px] text-night tabular">
            {index + 1} / {photos.length}
          </span>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-5 sm:px-0">
          {photos.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => go(i)}
              className={`h-16 w-20 shrink-0 overflow-hidden border-b-2 transition sm:h-20 sm:w-28 ${i === index ? "border-ink" : "border-transparent opacity-55 hover:opacity-100"}`}
              aria-label={`Ver foto ${i + 1}`}
            >
              <img src={publicPhotoUrl(id, true)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {zoom != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/95 p-4" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setZoom(null)}>
          <img src={publicPhotoUrl(photos[zoom])} alt={`${name} — foto ${zoom + 1}`} className="max-h-full max-w-full object-contain" />
          <button type="button" onClick={() => setZoom(null)} className="absolute right-4 top-4 h-11 border border-white/30 px-5 text-[14px] text-white hover:bg-white/10">
            Fechar
          </button>
          {photos.length > 1 ? (
            <div className="absolute bottom-6 flex gap-3" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setZoom((zoom - 1 + photos.length) % photos.length)} className="h-11 border border-white/30 px-5 text-[14px] text-white hover:bg-white/10">
                ← Anterior
              </button>
              <button type="button" onClick={() => setZoom((zoom + 1) % photos.length)} className="h-11 border border-white/30 px-5 text-[14px] text-white hover:bg-white/10">
                Próxima →
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
