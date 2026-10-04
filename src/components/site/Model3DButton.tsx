"use client";

import { useState } from "react";
import { LazyModel } from "@/components/three/LazyModel";
import type { ModelViewSettings } from "@/components/three/ModelViewer";
import { track } from "@/lib/analytics";

/**
 * Visualização 3D sob demanda: nada do three.js nem do arquivo do modelo é baixado
 * até o cliente tocar em "Visualizar em 3D". Girar, zoom (pinça no celular), resetar e tela cheia
 * vêm do mesmo visualizador usado no painel.
 */
export function Model3DButton({ url, settings, name, slug }: { url: string; settings: ModelViewSettings; name: string; slug: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          track("model3d_open", { product: slug });
        }}
        className="inline-flex h-12 items-center gap-2 rounded-full border border-night/20 px-5 text-[12px] font-semibold uppercase tracking-[0.14em] hover:border-night"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />
        </svg>
        Visualizar em 3D
      </button>
    );
  }
  return (
    <div className="mt-2">
      <LazyModel
        url={url}
        settings={settings}
        autoLoad={false}
        fallback={<p className="flex h-full items-center justify-center p-6 text-sm text-night/60">Não foi possível abrir o 3D neste aparelho. As fotos mostram a estrutura real.</p>}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-night/55">
        <span>Modelo 3D de {name}</span>
        <button type="button" onClick={() => setOpen(false)} className="underline underline-offset-4">Fechar 3D</button>
      </div>
    </div>
  );
}
