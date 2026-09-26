"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { LazyModel } from "@/components/three/LazyModel";
import type { ModelViewSettings } from "@/components/three/ModelViewer";

/** Mídia do produto: modelo 3D (quando existe) e galeria de fotos. Nunca mostra área vazia. */
export function ProductMedia({
  name,
  photoIds,
  model,
}: {
  name: string;
  photoIds: string[];
  model: { url: string; settings: ModelViewSettings } | null;
}) {
  const [active, setActive] = useState<"3d" | string>(model ? "3d" : (photoIds[0] ?? ""));
  const photoFallback = photoIds[0] ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/fotos/${photoIds[0]}`} alt={name} className="h-full w-full rounded-xl object-contain" />
  ) : (
    <Placeholder name={name} />
  );
  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-zinc-100">
        {active === "3d" && model ? (
          <LazyModel url={model.url} settings={model.settings} fallback={photoFallback} />
        ) : active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/fotos/${active}`} alt={name} className="h-[360px] w-full bg-white object-contain md:h-[460px]" />
        ) : (
          <div className="h-[360px] md:h-[460px]">
            <Placeholder name={name} />
          </div>
        )}
      </div>
      {(model ? 1 : 0) + photoIds.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {model ? (
            <button
              type="button"
              onClick={() => setActive("3d")}
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${active === "3d" ? "bg-ink text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"}`}
            >
              3D
            </button>
          ) : null}
          {photoIds.map((id) => (
            <button key={id} type="button" onClick={() => setActive(id)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ${active === id ? "ring-2 ring-ink" : "ring-1 ring-zinc-200"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fotos/${id}`} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex h-full min-h-60 w-full flex-col items-center justify-center gap-2 rounded-xl bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#e9edf3_75%)] text-zinc-400">
      <Icon name="tent" className="h-14 w-14" />
      <p className="text-sm font-medium text-zinc-500">{name}</p>
      <p className="text-xs">Sem foto ou modelo 3D cadastrado</p>
    </div>
  );
}
