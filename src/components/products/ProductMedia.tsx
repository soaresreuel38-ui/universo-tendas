"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { LazyModel } from "@/components/three/LazyModel";
import type { ModelViewSettings } from "@/components/three/ModelViewer";
import { ProductPlaceholder } from "./ProductImage";

/**
 * Galeria do produto: fotos reais (nunca distorcidas nem cortadas) e, quando existe um modelo GLB de verdade,
 * a visualização 3D. O 3D só é baixado quando a pessoa escolhe vê-lo (ou quando é a única mídia).
 */
export function ProductMedia({
  name,
  photoIds,
  model,
}: {
  name: string;
  photoIds: string[];
  model: { url: string; settings: ModelViewSettings } | null;
}) {
  const [mode, setMode] = useState<"fotos" | "3d">("fotos");
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  // Sempre um estado válido quando fotos/modelo mudam (ex.: logo após enviar um modelo ou foto).
  const current = Math.min(index, Math.max(0, photoIds.length - 1));
  const showing: "fotos" | "3d" = model && (mode === "3d" || photoIds.length === 0) ? "3d" : "fotos";
  const photo = photoIds[current];
  const count = photoIds.length;

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoom, count]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-white">
        {showing === "3d" && model ? (
          <LazyModel url={model.url} settings={model.settings} fallback={photo ? <Photo id={photo} name={name} /> : <ProductPlaceholder name={name} />} />
        ) : photo ? (
          <button type="button" onClick={() => setZoom(true)} className="group relative block w-full cursor-zoom-in" aria-label="Ampliar foto">
            <div className="aspect-[4/3] w-full">
              <Photo id={photo} name={name} key={photo} />
            </div>
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <Icon name="expand" className="h-3.5 w-3.5" /> Ampliar
            </span>
          </button>
        ) : (
          <div className="aspect-[4/3] w-full">
            <ProductPlaceholder name={name} />
          </div>
        )}

        {model && count ? (
          <div className="absolute right-3 top-3 z-10 inline-flex rounded-full bg-white/92 p-0.5 text-[12.5px] font-medium shadow-sm backdrop-blur" role="tablist" aria-label="Tipo de visualização">
            {(["fotos", "3d"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={showing === m}
                onClick={() => setMode(m)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${showing === m ? "bg-ink text-white" : "text-muted hover:text-graphite"}`}
              >
                <Icon name={m === "3d" ? "cube" : "image"} className="h-3.5 w-3.5" />
                {m === "3d" ? "Ver em 3D" : "Fotos"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {count > 1 || (model && count) ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photoIds.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setIndex(i);
                setMode("fotos");
              }}
              aria-label={`Foto ${i + 1}`}
              className={`h-[68px] w-[88px] shrink-0 overflow-hidden rounded-xl border-2 transition-[border-color,opacity] ${
                showing === "fotos" && current === i ? "border-ink" : "border-transparent opacity-75 hover:opacity-100"
              }`}
            >
              <img src={`/api/fotos/${id}?s=t`} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          {model ? (
            <button
              type="button"
              onClick={() => setMode("3d")}
              className={`flex h-[68px] w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 bg-white text-[11px] font-semibold text-graphite ${showing === "3d" ? "border-ink" : "border-line"}`}
            >
              <Icon name="cube" className="h-5 w-5 text-ink" />
              3D
            </button>
          ) : null}
        </div>
      ) : null}

      {zoom && photo ? (
        <div className="fixed inset-0 z-[70] flex animate-fade flex-col bg-[#0f1115]/95" role="dialog" aria-modal="true" aria-label={`Fotos de ${name}`}>
          <div className="flex items-center justify-between px-4 py-3 text-white/80">
            <span className="text-sm">
              {name} · {current + 1}/{count}
            </span>
            <button type="button" onClick={() => setZoom(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Fechar">
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            <img src={`/api/fotos/${photo}`} alt={name} className="max-h-full max-w-full animate-fade object-contain" key={photo} />
            {count > 1 ? (
              <>
                <button type="button" onClick={() => setIndex((current - 1 + count) % count)} className="absolute left-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Anterior">
                  <Icon name="chevronLeft" className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => setIndex((current + 1) % count)} className="absolute right-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Próxima">
                  <Icon name="chevronRight" className="h-5 w-5" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Carregamento progressivo: a miniatura aparece primeiro e a foto inteira entra por cima, sem cortar a imagem. */
function Photo({ id, name }: { id: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // Foto já em cache pode terminar de carregar antes da hidratação (o onLoad não dispara).
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <span className="relative block h-full w-full">
      {!loaded ? <img src={`/api/fotos/${id}?s=t`} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain" /> : null}
      <img
        ref={ref}
        src={`/api/fotos/${id}`}
        alt={name}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`relative h-full w-full object-contain transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
