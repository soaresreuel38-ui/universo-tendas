import type { Metadata } from "next";
import Link from "next/link";
import { NAV_GROUPS } from "@/components/layout/nav";
import { Icon } from "@/components/ui/icons";
import { can } from "@/lib/domain";
import { requireUser } from "@/server/auth/session";
import { logout } from "../../login/actions";

export const metadata: Metadata = { title: "Menu" };

/** Menu completo para o celular (a barra inferior mostra só os atalhos principais). */
export default async function MenuPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <Link href="/admin/conta" className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
          {user.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")}
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-graphite">{user.name}</span>
          <span className="block text-xs text-faint">Minha conta</span>
        </span>
        <Icon name="chevronRight" className="h-4 w-4 text-faint" />
      </Link>
      {NAV_GROUPS.map((g, i) => {
        const items = g.items.filter((it) => !it.permission || can(user.role, it.permission));
        if (!items.length) return null;
        return (
          <section key={i}>
            {g.title ? <h2 className="eyebrow mb-2 px-1">{g.title}</h2> : null}
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-paper">
                    <Icon name={it.icon} className="h-5 w-5 text-ink" />
                    <span className="flex-1">
                      <span className="block text-[15px] font-medium text-graphite">{it.label}</span>
                      {it.hint ? <span className="block text-xs text-faint">{it.hint}</span> : null}
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <form action={logout}>
        <button className="h-12 w-full rounded-2xl border border-line bg-white font-medium text-accent">Sair</button>
      </form>
    </div>
  );
}
