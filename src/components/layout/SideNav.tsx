"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Role } from "@/lib/domain";
import { Icon } from "@/components/ui/icons";
import { MOBILE_TABS, NAV_GROUPS, isActive } from "./nav";

export function SideNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group, gi) => {
        const items = group.items.filter((i) => !i.permission || can(role, i.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi}>
            {group.title ? <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{group.title}</p> : null}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active ? "bg-white/10 font-medium text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                      }`}
                    >
                      <Icon name={item.icon} className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
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

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden" aria-label="Navegação principal">
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pb-1 pt-2 text-[11px] ${active ? "font-semibold text-zinc-900" : "text-zinc-500"}`}
              >
                <Icon name={tab.icon} className={`h-5 w-5 ${active ? "text-accent" : ""}`} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
