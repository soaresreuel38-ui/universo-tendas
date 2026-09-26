"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { can, type Role } from "@/lib/domain";
import { CREATE_ACTIONS } from "./nav";

type Hit = { group: string; href: string; title: string; sub: string; photoId?: string | null; badge?: string };

const OPEN_EVENT = "ut:open-search";
export const openSearch = () => window.dispatchEvent(new Event(OPEN_EVENT));

/** Busca universal instantânea (atalho "/" ou Ctrl/⌘+K). */
export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      setActive(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Resultados instantâneos com pequena espera entre as teclas.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/busca?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { hits?: Hit[] };
        setHits(json.hits ?? []);
        setSearched(term);
        setActive(0);
      } catch {
        /* cancelada */
      } finally {
        setLoading(false);
      }
    }, 140);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const actions = useMemo(
    () =>
      CREATE_ACTIONS.filter((a) => !a.permission || can(role, a.permission))
        .filter((a) => !q.trim() || a.label.toLowerCase().includes(q.trim().toLowerCase()))
        .map((a) => ({ group: "Ações", href: a.href, title: a.label, sub: a.hint, key: a.key })),
    [q, role],
  );
  const searching = q.trim().length >= 2;
  const items: Array<Hit & { key?: string }> = searching ? [...hits, ...actions] : actions;

  const close = () => {
    setOpen(false);
    setQ("");
    setHits([]);
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Busca">
      <button type="button" aria-label="Fechar busca" className="absolute inset-0 animate-fade bg-graphite/35 backdrop-blur-[2px]" onClick={close} />
      <div className="relative mx-auto mt-0 flex max-h-dvh w-full max-w-2xl animate-sheet flex-col overflow-hidden bg-white sm:mt-[12vh] sm:max-h-[70vh] sm:rounded-2xl sm:border sm:border-line sm:shadow-[0_24px_60px_-20px_rgba(22,24,29,0.35)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" className="h-5 w-5 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const it = items[active];
                if (it) go(it.href);
                else if (q.trim()) go(`/admin/busca?q=${encodeURIComponent(q.trim())}`);
              }
            }}
            placeholder="Cliente, CPF/CNPJ, telefone, produto, código, contrato, evento…"
            aria-label="Busca global"
            className="h-14 flex-1 bg-transparent text-[15px] text-graphite outline-none placeholder:text-faint"
          />
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" aria-label="Buscando" /> : null}
          <button type="button" onClick={close} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-faint">
            Esc
          </button>
        </div>
        <ul ref={listRef} className="flex-1 overflow-y-auto p-2" role="listbox">
          {searching && !loading && searched === q.trim() && hits.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted">Nada encontrado para “{q.trim()}”.</li>
          ) : null}
          {items.map((it, i) => {
            const header = i === 0 || items[i - 1].group !== it.group ? it.group : null;
            return (
              <li key={`${it.group}-${it.href}`}>
                {header ? <p className="eyebrow px-3 pb-1 pt-3">{header}</p> : null}
                <button
                  type="button"
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(it.href)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${i === active ? "bg-ink-tint" : ""}`}
                >
                  {it.group === "Produtos" ? (
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line bg-canvas">
                      {it.photoId ? <img src={`/api/fotos/${it.photoId}?s=t`} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-graphite">{it.title}</span>
                    {it.sub ? <span className="block truncate text-xs text-faint">{it.sub}</span> : null}
                  </span>
                  {it.badge ? <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{it.badge}</span> : null}
                  {"key" in it && it.key ? <kbd className="rounded border border-line bg-paper px-1.5 font-mono text-[11px] text-faint">{it.key}</kbd> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {q.trim() ? (
          <button
            type="button"
            onClick={() => go(`/admin/busca?q=${encodeURIComponent(q.trim())}`)}
            className="flex items-center justify-between border-t border-line px-5 py-3 text-left text-[13px] text-muted hover:bg-paper"
          >
            Ver todos os resultados para “{q.trim()}”
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
