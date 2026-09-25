import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { isDatabaseConfigured } from "@/server/db";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (!isDatabaseConfigured) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
        <div className="w-full max-w-md rounded-xl bg-white p-6 text-sm text-zinc-700 shadow-xl">
          <h1 className="text-lg font-semibold text-zinc-900">Banco de dados não conectado</h1>
          <p className="mt-2">
            O sistema está publicado, mas ainda não há um banco PostgreSQL ligado a ele. Na Vercel, abra o projeto →
            <b> Storage</b> → <b>Connect Database</b> → <b>Neon</b>, e depois faça um novo deploy.
          </p>
        </div>
      </main>
    );
  }
  if (await getCurrentUser()) redirect("/admin");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-white">
          <Logo />
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <h1 className="text-lg font-semibold text-zinc-900">Acesso ao sistema</h1>
          <p className="mb-5 mt-1 text-sm text-zinc-500">Estoque, locações e vendas.</p>
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">Sinop - MT · Uso interno</p>
      </div>
    </main>
  );
}
