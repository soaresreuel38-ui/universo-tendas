"use client";

import { useEffect } from "react";

/** Marca a página como "rolada" para o cabeçalho transparente da capa ganhar fundo. */
export function HeaderScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      if (window.scrollY > 40) root.setAttribute("data-scrolled", "");
      else root.removeAttribute("data-scrolled");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      root.removeAttribute("data-scrolled");
    };
  }, []);
  return null;
}
