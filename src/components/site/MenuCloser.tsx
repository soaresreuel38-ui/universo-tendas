"use client";

import { useEffect } from "react";

/** Fecha o menu do celular ao tocar num link (inclusive âncoras da mesma página, como #contato). */
export function MenuCloser() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      const menu = link?.closest("details[data-site-menu]");
      if (menu) menu.removeAttribute("open");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
