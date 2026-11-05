"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { publicPhotoUrl } from "@/lib/public-urls";

export type GalleryItem = { id: string; name: string; path: string };

/** Proporções alternadas para uma composição assimétrica (sem grade de cartões iguais). */
const LAYOUT = [
  "md:col-span-7 aspect-[4/3] md:aspect-auto md:row-span-2",
  "md:col-span-5 aspect-[4/3]",
  "md:col-span-5 aspect-[4/3]",
  "md:col-span-4 aspect-[3/4] md:aspect-[4/5]",
  "md:col-span-8 aspect-[4/3] md:aspect-[16/10]",
];

/** Galeria da página inicial: somente fotos reais cadastradas no catálogo, com visualização ampliada. */
export function HomeGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, step]);

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4">
        {items.map((it, i) => (
          <li key={`${it.id}-${i}`} className={`reveal group relative overflow-hidden bg-night ${LAYOUT[i % LAYOUT.length]}`} style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
            <button type="button" onClick={() => setOpen(i)} className="absolute inset-0 block h-full w-full cursor-zoom-in" aria-label={`Ampliar foto: ${it.name}`}>
              <img
                src={publicPhotoUrl(it.id)}
                alt={it.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/65 via-black/10 to-transparent p-5 pt-16 text-left opacity-90 transition-opacity duration-500 md:opacity-0 md:group-hover:opacity-100">
                <span className="text-[15px] font-medium text-white">{it.name}</span>
                <span aria-hidden className="text-[13px] text-brand">Ampliar ↗</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open != null ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-coal/[0.97]" role="dialog" aria-modal="true" aria-label={`Foto: ${items[open].name}`} onClick={close}>
          <div className="flex items-center justify-between px-5 py-4 text-white sm:px-8" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] text-white/70">
              <span className="tabular text-brand">
                {open + 1} / {items.length}
              </span>
              <span className="mx-3 text-white/25">|</span>
              <Link href={items[open].path} className="underline decoration-white/30 underline-offset-4 hover:decoration-white">
                {items[open].name}
              </Link>
            </p>
            <button type="button" onClick={close} className="h-10 border border-white/25 px-4 text-[14px] text-white transition-colors hover:border-white">
              Fechar
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            <img src={publicPhotoUrl(items[open].id)} alt={items[open].name} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
          {items.length > 1 ? (
            <div className="flex justify-center gap-3 pb-6" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => step(-1)} className="h-11 border border-white/25 px-5 text-[14px] text-white transition-colors hover:border-white">
                ← Anterior
              </button>
              <button type="button" onClick={() => step(1)} className="h-11 border border-white/25 px-5 text-[14px] text-white transition-colors hover:border-white">
                Próxima →
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
