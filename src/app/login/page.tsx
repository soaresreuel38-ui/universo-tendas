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
        <svg viewBox="0 0 600 340" className="absolute left-1/2 top-[20%] w-[74%] -translate-x-1/2 text-white/25" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          <path d="M40 300 300 60l260 240M300 60v240M170 300l130-120 130 120M40 300h520" />
          <path d="M300 60V24M40 300v-40M560 300v-40M110 300l190-176 190 176" strokeDasharray="4 6" />
          <path d="M40 318h520M40 312v12M560 312v12M300 312v12" />
          <text x="300" y="336" textAnchor="middle" fill="currentColor" stroke="none" fontSize="11" letterSpacing="3">
            ESTRUTURA · LOCAÇÃO DE TENDAS
          </text>
        </svg>
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
