import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BottomTabs, SideNav } from "@/components/layout/SideNav";
import { Icon } from "@/components/ui/icons";
import { ROLE_LABEL } from "@/lib/domain";
import { requireUser } from "@/server/auth/session";
import { logout } from "../login/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh lg:pl-60">
      {/* Barra lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink text-white lg:flex">
        <Link href="/admin" className="flex h-14 items-center border-b border-white/10 px-4">
          <Logo />
        </Link>
        <SideNav role={user.role} />
        <div className="border-t border-white/10 p-3">
          <Link href="/admin/conta" className="block rounded-md px-2 py-1.5 hover:bg-white/5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-zinc-400">{ROLE_LABEL[user.role]}</p>
          </Link>
          <form action={logout}>
            <button className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">
              <Icon name="logout" className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Barra superior */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Link href="/admin" className="rounded-md bg-ink p-1 text-white lg:hidden" aria-label="Início">
            <Logo compact />
          </Link>
          <form action="/admin/busca" className="relative flex-1 lg:max-w-md" role="search">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              name="q"
              type="search"
              placeholder="Buscar produto, código, cliente, telefone, locação…"
              className="h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
              aria-label="Busca global"
            />
          </form>
          <Link href="/admin/conta" className="hidden text-sm text-zinc-600 hover:text-zinc-900 sm:block lg:hidden">
            {user.name.split(" ")[0]}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 lg:px-6 lg:pb-10">{children}</main>
      <BottomTabs />
    </div>
  );
}
