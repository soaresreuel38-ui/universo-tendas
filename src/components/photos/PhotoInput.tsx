"use client";

import { useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

/** Reduz a foto no próprio celular antes de enviar (economiza dados e espaço no banco). */
async function compress(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

async function upload(file: File): Promise<string> {
  const blob = await compress(file);
  const body = new FormData();
  body.append("file", blob, "foto.jpg");
  const res = await fetch("/api/fotos", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !json.id) throw new Error(json.error ?? "Falha ao enviar a foto.");
  return json.id;
}

/**
 * Campo de foto: no celular o sistema oferece tirar foto com a câmera ou escolher da galeria. Guarda os ids enviados em
 * um input oculto (um por foto) com o nome informado.
 */
export function PhotoInput({
  name,
  initial = [],
  multiple = false,
  label = "Adicionar foto",
}: {
  name: string;
  initial?: string[];
  multiple?: boolean;
  label?: string;
}) {
  const [ids, setIds] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      const list = multiple ? Array.from(files) : [files[0]];
      const uploaded: string[] = [];
      for (const f of list) uploaded.push(await upload(f));
      setIds((prev) => (multiple ? [...prev, ...uploaded] : uploaded));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar a foto.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {ids.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <div key={id} className="relative h-20 w-20 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/fotos/${id}`} alt="Foto anexada" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setIds((prev) => prev.filter((x) => x !== id))}
              className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
              aria-label="Remover foto"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {multiple || ids.length === 0 ? (
          <label
            htmlFor={inputId}
            className={`flex h-20 min-w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 px-3 text-xs text-zinc-600 hover:border-zinc-400 ${busy ? "opacity-50" : ""}`}
          >
            <Icon name="camera" className="h-5 w-5" />
            {busy ? "Enviando…" : label}
          </label>
        ) : null}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={busy}
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
      />
      {!multiple && ids.length > 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 text-xs text-zinc-600 underline">
          Trocar foto
        </button>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
