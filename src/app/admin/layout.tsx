import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { BottomTabs, SearchTrigger, SideNav } from "@/components/layout/SideNav";
import { Shortcuts } from "@/components/layout/Shortcuts";
import { Icon } from "@/components/ui/icons";
import { ROLE_LABEL } from "@/lib/domain";
import { requireUser } from "@/server/auth/session";
import { logout } from "../login/actions";

export const metadata: Metadata = {
  title: { default: "Universo Tendas — Gestão", template: "%s · Universo Tendas" },
  description: "Sistema interno de estoque, locações e vendas da Universo Tendas (Sinop - MT).",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div className="min-h-dvh lg:pl-[248px]">
      {/* Barra lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-paper lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/admin/hoje" aria-label="Início">
            <Logo />
          </Link>
        </div>
        <div className="px-3 pb-3">
          <SearchTrigger />
        </div>
        <SideNav role={user.role} />
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Link href="/admin/conta" className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">{initials}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-graphite">{user.name}</span>
                <span className="block text-[11px] text-faint">{ROLE_LABEL[user.role]}</span>
              </span>
            </Link>
            <form action={logout}>
              <button className="rounded-md p-1.5 text-faint transition-colors hover:bg-black/5 hover:text-graphite" aria-label="Sair" title="Sair">
                <Icon name="logout" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/admin/hoje" aria-label="Início">
            <Logo compact />
          </Link>
          <div className="min-w-0 flex-1">
            <SearchTrigger compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-14 lg:pt-10">{children}</main>
      <BottomTabs role={user.role} />
      <CommandPalette role={user.role} />
      <Shortcuts />
    </div>
  );
}
