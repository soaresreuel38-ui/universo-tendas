"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Campo para desenhar a assinatura com o dedo (celular/tablet) ou o mouse.
 * Grava a imagem PNG em um input oculto.
 */
export function SignaturePad({ name = "signature", onChange }: { name?: string; onChange?: (hasInk: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current!;
    let width = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // No celular a barra de endereço dispara "resize" só na altura: não apaga a assinatura por isso.
      if (Math.round(rect.width) === width) return;
      const previous = width ? canvas.toDataURL("image/png") : null;
      width = Math.round(rect.width);
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0b1f3f";
      if (previous) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = previous;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const commit = () => {
    const url = canvasRef.current!.toDataURL("image/png");
    setValue(url);
    onChange?.(true);
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="relative rounded-lg border border-line-strong bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Área para assinar"
          className="block h-44 w-full touch-none cursor-crosshair"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const ctx = canvasRef.current!.getContext("2d")!;
            const p = point(e);
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={() => {
            if (drawing.current) commit();
            drawing.current = false;
            last.current = null;
          }}
          onPointerLeave={() => {
            if (drawing.current) commit();
            drawing.current = false;
          }}
        />
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-dashed border-line-strong" />
        <span className="pointer-events-none absolute bottom-2 left-6 text-xs text-faint">Assine acima da linha</span>
      </div>
      <button
        type="button"
        onClick={() => {
          const c = canvasRef.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          setValue("");
          onChange?.(false);
        }}
        className="mt-1 text-sm text-muted underline"
      >
        Limpar assinatura
      </button>
    </div>
  );
}
