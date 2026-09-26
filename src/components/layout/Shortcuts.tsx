"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { openSearch } from "./CommandPalette";

const ROUTES: Record<string, string> = {
  n: "/admin/locacoes/nova",
  c: "/admin/clientes/novo",
  p: "/admin/produtos",
  e: "/admin/estoque/entrada",
  s: "/admin/estoque/saida",
  r: "/admin/retorno",
};

function typing(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.closest("[role=dialog]") != null;
}

/** Atalhos: N locação, C cliente, P produtos, E entrada, S saída, R retorno, / busca. Não age enquanto se digita. */
export function Shortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        openSearch();
        return;
      }
      const href = ROUTES[e.key.toLowerCase()];
      if (href && !e.shiftKey) {
        e.preventDefault();
        router.push(href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
