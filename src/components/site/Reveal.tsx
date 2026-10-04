"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Animação discreta de entrada (elementos com a classe .reveal) e registro de visita.
 * Nunca deixa conteúdo escondido: o que está na tela ou já ficou para trás (ex.: link para #contato)
 * aparece na hora. Sem JavaScript, ou com "reduzir movimento", tudo aparece normalmente.
 */
export function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    track("page_view", { path: pathname });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let frame = 0;
    const sweep = () => {
      frame = 0;
      const limit = window.innerHeight * 0.95;
      document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)").forEach((el) => {
        if (el.getBoundingClientRect().top < limit) el.classList.add("is-in");
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sweep);
    };
    sweep();
    root.classList.add("reveal-ready");
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    // Conteúdo que chega depois (filtros, navegação na mesma página) também entra na varredura.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      mo.disconnect();
    };
  }, [pathname]);
  return null;
}
