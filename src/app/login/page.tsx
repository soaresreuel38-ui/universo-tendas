import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { isDatabaseConfigured } from "@/server/db";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";
import { TentDrawing } from "@/components/brand/TentDrawing";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (!isDatabaseConfigured) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ink px-4 py-10">
        <div className="w-full max-w-md rounded-xl bg-white p-6 text-sm text-muted shadow-xl">
          <h1 className="text-lg font-semibold text-graphite">Banco de dados não conectado</h1>
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
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Painel da marca: prancha técnica de uma tenda, sem imagens genéricas */}
      <section className="relative hidden overflow-hidden bg-ink-deep text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <svg className="absolute inset-0 h-full w-full text-white/[0.06]" aria-hidden>
          <defs>
            <pattern id="login-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0v32" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-grid)" />
        </svg>
        <div className="absolute inset-x-12 top-[17%] grid grid-cols-2 items-end gap-10 text-white/30" aria-hidden>
          <figure>
            <TentDrawing variant="piramide" strokeWidth={1.1} className="w-full" />
            <figcaption className="mt-3 border-t border-white/15 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Perspectiva</figcaption>
          </figure>
          <figure>
            <TentDrawing variant="articulada" strokeWidth={1.1} className="w-full" />
            <figcaption className="mt-3 border-t border-white/15 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Vista frontal</figcaption>
          </figure>
        </div>
        <div className="relative">
          <Logo tone="light" />
        </div>
        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Sistema de gestão</p>
          <p className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.025em]">Estoque, locações, contratos e operação do dia — em um só lugar.</p>
          <p className="mt-4 text-sm text-white/60">Universo Tendas · Sinop - MT</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <p className="eyebrow">Acesso restrito</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.025em] text-graphite">Entrar</h1>
          <p className="mb-8 mt-1.5 text-sm text-muted">Use o e-mail e a senha cadastrados pelo administrador.</p>
          <LoginForm />
          <p className="mt-10 text-xs text-faint">Uso interno · Universo Tendas</p>
        </div>
      </section>
    </main>
  );
}
