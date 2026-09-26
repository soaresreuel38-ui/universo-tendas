"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ModelViewSettings } from "./ModelViewer";

// O código do 3D (three.js) só é baixado quando o visualizador aparece na tela.
const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => <ViewerSkeleton />,
});

function ViewerSkeleton() {
  return (
    <div className="flex h-[360px] w-full items-center justify-center rounded-xl bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#e9edf3_75%)] md:h-[460px]">
      <p className="text-xs font-medium text-zinc-500">Preparando visualização 3D…</p>
    </div>
  );
}

export function LazyModel({
  url,
  settings,
  fallback,
  onCapture,
  autoLoad = true,
}: {
  url: string;
  settings: ModelViewSettings;
  fallback: ReactNode;
  onCapture?: (v: { position: [number, number, number]; target: [number, number, number] }) => void;
  autoLoad?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!autoLoad) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [autoLoad]);
  return (
    <div ref={ref}>
      {visible || !autoLoad ? <ModelViewer url={url} settings={settings} fallback={fallback} onCapture={onCapture} /> : <ViewerSkeleton />}
    </div>
  );
}
