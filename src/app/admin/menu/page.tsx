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
    <div className="space-y-5">
      <div>
        <p className="text-lg font-semibold">{user.name}</p>
        <Link href="/admin/conta" className="text-sm text-zinc-600 underline">Minha conta</Link>
      </div>
      {NAV_GROUPS.map((g, i) => {
        const items = g.items.filter((it) => !it.permission || can(user.role, it.permission));
        if (!items.length) return null;
        return (
          <section key={i}>
            {g.title ? <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">{g.title}</h2> : null}
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              {items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-zinc-50">
                    <Icon name={it.icon} className="h-5 w-5 text-zinc-500" />
                    <span className="flex-1">
                      <span className="block font-medium">{it.label}</span>
                      {it.hint ? <span className="block text-xs text-zinc-500">{it.hint}</span> : null}
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 text-zinc-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <form action={logout}>
        <button className="h-12 w-full rounded-lg border border-zinc-300 bg-white font-medium text-red-700">Sair</button>
      </form>
    </div>
  );
}
