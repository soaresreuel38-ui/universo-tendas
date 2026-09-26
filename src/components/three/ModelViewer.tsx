"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export type ModelViewSettings = {
  cameraPosition: [number, number, number] | null;
  cameraTarget: [number, number, number] | null;
  scale: number;
  rotationY: number;
};

type Api = { reset: () => void; capture: () => { position: [number, number, number]; target: [number, number, number] } };

/** Tamanho de referência: o maior lado do modelo vira ~4 unidades (independe da unidade do arquivo). */
const FIT = 4;

function Model({ url, scale, rotationY, onBox }: { url: string; scale: number; rotationY: number; onBox: (height: number, radius: number) => void }) {
  // Sem Draco (evita baixar decodificador de CDN externo); Meshopt é embutido.
  const { scene } = useGLTF(url, false, true);
  const object = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const k = (FIT / Math.max(size.x, size.y, size.z, 1e-6)) * scale;
    root.scale.setScalar(k);
    const b2 = new THREE.Box3().setFromObject(root);
    const c = b2.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -b2.min.y, -c.z); // centraliza e apoia no chão
    return root;
  }, [scene, scale]);
  useEffect(() => {
    const b = new THREE.Box3().setFromObject(object);
    const s = b.getSize(new THREE.Vector3());
    onBox(s.y, Math.max(s.x, s.z) / 2);
  }, [object, onBox]);
  return (
    <group rotation-y={THREE.MathUtils.degToRad(rotationY)}>
      <primitive object={object} />
    </group>
  );
}

function Rig({ apiRef, initial, box }: { apiRef: React.RefObject<Api | null>; initial: ModelViewSettings; box: { h: number; r: number } | null }) {
  const { camera, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const defaults = useMemo(() => {
    const h = box?.h ?? 3;
    const r = box?.r ?? 2;
    const dist = Math.max(h, r * 2) * 1.9 + 2;
    return {
      position: (initial.cameraPosition ?? [dist * 0.85, dist * 0.5, dist * 0.85]) as [number, number, number],
      target: (initial.cameraTarget ?? [0, h * 0.4, 0]) as [number, number, number],
    };
  }, [box, initial.cameraPosition, initial.cameraTarget]);

  useEffect(() => {
    const reset = () => {
      camera.position.set(...defaults.position);
      controls.current?.target.set(...defaults.target);
      controls.current?.update();
      invalidate();
    };
    reset();
    apiRef.current = {
      reset,
      capture: () => {
        const t = controls.current?.target ?? new THREE.Vector3();
        const r = (n: number) => Math.round(n * 100) / 100;
        return { position: [r(camera.position.x), r(camera.position.y), r(camera.position.z)], target: [r(t.x), r(t.y), r(t.z)] };
      },
    };
  }, [camera, defaults, apiRef, invalidate]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={1.5}
      maxDistance={40}
      maxPolarAngle={Math.PI / 2 - 0.02}
      enablePan
    />
  );
}

function Loader() {
  const { progress, active } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
      <div className="h-1 w-40 overflow-hidden rounded-full bg-canvas">
        <div className="h-full bg-ink transition-[width]" style={{ width: `${Math.max(8, progress)}%` }} />
      </div>
      <p className="text-xs font-medium text-faint">Carregando modelo 3D… {Math.round(progress)}%</p>
    </div>
  );
}

class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function ModelViewer({
  url,
  settings,
  fallback,
  onCapture,
  height = "h-[360px] md:h-[460px]",
}: {
  url: string;
  settings: ModelViewSettings;
  fallback: ReactNode;
  onCapture?: (view: { position: [number, number, number]; target: [number, number, number] }) => void;
  height?: string;
}) {
  const apiRef = useRef<Api | null>(null);
  const [box, setBox] = useState<{ h: number; r: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [supported] = useState(() => (typeof window === "undefined" ? true : webglAvailable()));
  const onBox = useMemo(() => (h: number, r: number) => setBox((b) => (b && b.h === h && b.r === r ? b : { h, r })), []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded]);

  if (!supported) return <>{fallback}</>;

  return (
    <div
      className={
        expanded
          ? "fixed inset-0 z-50 bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#e9edf3_70%)]"
          : `relative ${height} w-full overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#e9edf3_75%)]`
      }
      data-testid="model-viewer"
    >
      <ErrorBoundary fallback={<div className="absolute inset-0">{fallback}</div>}>
        <Canvas shadows dpr={[1, 2]} frameloop="demand" camera={{ fov: 35, near: 0.1, far: 200, position: [8, 5, 8] }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <ambientLight intensity={0.45} />
          <directionalLight position={[6, 10, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
          <Suspense fallback={null}>
            <Model url={url} scale={settings.scale} rotationY={settings.rotationY} onBox={onBox} />
            <Environment resolution={128}>
              <Lightformer form="rect" intensity={2.2} position={[0, 6, -8]} scale={[12, 4, 1]} />
              <Lightformer form="rect" intensity={1.2} position={[-8, 3, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
              <Lightformer form="rect" intensity={1.2} position={[8, 3, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
              <Lightformer form="circle" intensity={3} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={4} />
            </Environment>
          </Suspense>
          <ContactShadows position={[0, 0.001, 0]} opacity={0.38} scale={14} blur={2.4} far={6} frames={1} />
          <Rig apiRef={apiRef} initial={settings} box={box} />
        </Canvas>
      </ErrorBoundary>
      <Loader />

      <div className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur">
        Arraste para girar · role ou pince para aproximar
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1.5">
        {onCapture ? (
          <button
            type="button"
            onClick={() => apiRef.current && onCapture(apiRef.current.capture())}
            className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-graphite shadow-sm ring-1 ring-line hover:bg-white"
          >
            Usar este ângulo como inicial
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => apiRef.current?.reset()}
          className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-graphite shadow-sm ring-1 ring-line hover:bg-white"
        >
          Resetar câmera
        </button>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-sm"
        >
          {expanded ? "Fechar" : "Tela cheia"}
        </button>
      </div>
    </div>
  );
}
