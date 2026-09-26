"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LazyModel } from "@/components/three/LazyModel";
import type { ModelViewSettings } from "@/components/three/ModelViewer";
import { InlineAction } from "@/components/ui/forms";
import { Field, Input, buttonClass } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";

export function ModelManager({
  productId,
  model,
  saveView,
  removeAction,
}: {
  productId: string;
  model: { url: string; fileName: string; size: number; settings: ModelViewSettings } | null;
  saveView: (productId: string, view: unknown) => Promise<{ ok: boolean; message: string }>;
  removeAction: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [view, setView] = useState<ModelViewSettings>(model?.settings ?? { cameraPosition: null, cameraTarget: null, scale: 1, rotationY: 0 });
  const [previewKey, setPreviewKey] = useState(0);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/modelos/${productId}`, { method: "POST", body });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Falha no envio." });
    setMsg({ ok: true, text: "Modelo enviado." });
    router.refresh();
  }

  async function persist(next: ModelViewSettings, text: string) {
    setView(next);
    const r = await saveView(productId, next);
    setMsg({ ok: r.ok, text: r.ok ? text : r.message });
    if (r.ok) {
      setPreviewKey((k) => k + 1);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {model ? (
        <>
          <LazyModel
            key={previewKey}
            url={model.url}
            settings={view}
            fallback={<p className="p-6 text-sm text-red-700">Não foi possível exibir este modelo.</p>}
            onCapture={(v) => persist({ ...view, cameraPosition: v.position, cameraTarget: v.target }, "Ângulo inicial salvo.")}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Escala" hint="1 = tamanho automático">
              <Input type="number" step="0.1" min="0.1" max="100" value={view.scale} onChange={(e) => setView({ ...view, scale: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Rotação inicial (graus)">
              <Input type="number" step="15" min="-360" max="360" value={view.rotationY} onChange={(e) => setView({ ...view, rotationY: Number(e.target.value) || 0 })} />
            </Field>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-3">
              <button type="button" className={buttonClass("primary", "md")} onClick={() => persist(view, "Escala e rotação salvas.")}>
                Salvar ajustes
              </button>
              <button
                type="button"
                className={buttonClass("ghost", "md")}
                onClick={() => persist({ ...view, cameraPosition: null, cameraTarget: null }, "Câmera volta ao enquadramento automático.")}
              >
                Câmera automática
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Arquivo: {model.fileName} · {model.size < 1024 * 1024 ? `${Math.max(1, Math.round(model.size / 1024))} KB` : `${(model.size / 1024 / 1024).toFixed(1)} MB`}
          </p>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Nenhum modelo 3D. Sem modelo, o catálogo mostra a foto principal do produto.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${buttonClass("secondary", "md")} cursor-pointer ${busy ? "opacity-50" : ""}`}>
          {busy ? "Enviando…" : model ? "Substituir modelo (.glb)" : "Enviar modelo 3D (.glb)"}
          <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {model ? (
          <InlineAction action={removeAction} fields={{ productId }} variant="danger" size="md" confirm="Remover o modelo 3D deste produto?">
            Remover modelo
          </InlineAction>
        ) : null}
      </div>
      <p className="text-xs text-zinc-500">Formato .glb (recomendado) até 4 MB. Otimize texturas (ex.: 1024 px, WebP) e geometria antes de enviar.</p>
      {msg ? <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p> : null}
    </div>
  );
}
