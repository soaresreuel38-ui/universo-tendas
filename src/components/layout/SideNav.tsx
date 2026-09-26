"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { can, type Role } from "@/lib/domain";
import { Icon } from "@/components/ui/icons";
import { CREATE_ACTIONS, MOBILE_TABS, NAV_GROUPS, isActive } from "./nav";
import { openSearch } from "./CommandPalette";

export function SideNav({ role }: { role: Role }) {
  const pathname = usePathname();
  // O item mais específico que casa com a rota fica ativo (ex.: Estoque × Entrada de estoque).
  const all = NAV_GROUPS.flatMap((g) => g.items).filter((i) => isActive(pathname, i.href));
  const current = all.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4 pt-2" aria-label="Menu principal">
      {NAV_GROUPS.map((group, gi) => {
        const items = group.items.filter((i) => !i.permission || can(role, i.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi}>
            {group.title ? <p className="eyebrow px-2.5 pb-1.5 !text-[10.5px]">{group.title}</p> : null}
            <ul className="space-y-px">
              {items.map((item) => {
                const active = item.href === current;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors ${
                        active ? "bg-ink-tint font-medium text-ink" : "text-muted hover:bg-black/[0.035] hover:text-graphite"
                      }`}
                    >
                      {active ? <span className="absolute -left-3 top-1.5 h-5 w-[3px] rounded-r-full bg-ink" aria-hidden /> : null}
                      <Icon name={item.icon} className={`h-[17px] w-[17px] ${active ? "text-ink" : "text-faint group-hover:text-muted"}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function SearchTrigger({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={openSearch}
      className={`flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-white text-left text-[13px] text-faint transition-colors hover:border-line-strong hover:text-muted ${compact ? "px-2.5" : "px-3"}`}
    >
      <Icon name="search" className="h-4 w-4" />
      <span className="flex-1 truncate">Buscar cliente, CPF, produto, contrato…</span>
      <kbd className="rounded border border-line bg-paper px-1.5 font-mono text-[11px] text-faint">/</kbd>
    </button>
  );
}

export function BottomTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const left = MOBILE_TABS.slice(0, 2);
  const right = MOBILE_TABS.slice(2);
  const tab = (t: (typeof MOBILE_TABS)[number]) => {
    const active = isActive(pathname, t.href);
    return (
      <li key={t.href}>
        <Link
          href={t.href}
          aria-current={active ? "page" : undefined}
          className={`flex flex-col items-center gap-1 pb-1 pt-2.5 text-[10.5px] font-medium ${active ? "text-ink" : "text-faint"}`}
        >
          <Icon name={t.icon} className="h-[22px] w-[22px]" />
          {t.label}
        </Link>
      </li>
    );
  };
  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/92 backdrop-blur-xl lg:hidden" aria-label="Navegação principal">
        <ul className="grid grid-cols-5 items-end">
          {left.map(tab)}
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Criar"
              aria-haspopup="dialog"
              className="-mt-3 mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white shadow-[0_6px_16px_-6px_rgba(12,63,128,0.6)] transition-transform active:scale-95"
            >
              <Icon name="plus" className="h-6 w-6" />
            </button>
          </li>
          {right.map(tab)}
        </ul>
      </nav>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Criar">
          <button type="button" className="absolute inset-0 animate-fade bg-graphite/40" aria-label="Fechar" onClick={() => setOpen(false)} />
          <div className="pb-safe absolute inset-x-0 bottom-0 animate-sheet rounded-t-3xl bg-white px-4 pt-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            <p className="eyebrow mb-2 px-1">Criar</p>
            <ul className="grid grid-cols-2 gap-2 pb-4">
              {CREATE_ACTIONS.filter((a) => !a.permission || can(role, a.permission)).map((a, i) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className={`flex h-full items-start gap-3 rounded-2xl border p-3.5 active:scale-[0.99] ${i === 0 ? "border-ink bg-ink text-white" : "border-line bg-paper text-graphite"}`}
                  >
                    <Icon name={a.icon} className={`mt-0.5 h-5 w-5 shrink-0 ${i === 0 ? "text-white" : "text-ink"}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">{a.label}</span>
                      <span className={`mt-0.5 block text-[11.5px] leading-snug ${i === 0 ? "text-white/70" : "text-faint"}`}>{a.hint}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
