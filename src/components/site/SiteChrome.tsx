/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatPhone } from "@/lib/br-documents";
import { whatsappLink } from "@/lib/format";
import { instagramUrl, type SiteSettings } from "@/server/site-data";

const NAV = [
  { href: "/tendas", label: "Tendas" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/minha-reserva", label: "Minha reserva" },
  { href: "/#contato", label: "Contato" },
];

export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src="/brand/universo-logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[10px]" />
      <span className={`leading-none ${tone === "light" ? "text-white" : "text-night"}`}>
        <span className="block font-display text-[19px] font-medium tracking-[-0.01em]">Universo Tendas</span>
        <span className={`mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.22em] ${tone === "light" ? "text-white/60" : "text-night/50"}`}>
          Estruturas para eventos
        </span>
      </span>
    </span>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const light = overlay;
  return (
    <header className={`${overlay ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b border-night/10 bg-linen/90 backdrop-blur"}`}>
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label="Universo Tendas — início" className="shrink-0">
          <Brand tone={light ? "light" : "dark"} />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`link-grow text-[14px] ${light ? "text-white/85 hover:text-white" : "text-night/75 hover:text-night"}`}>
              {n.label}
            </Link>
          ))}
          <Link
            href="/reservar"
            className={`inline-flex h-11 items-center rounded-full px-5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              light ? "bg-white text-night hover:bg-linen" : "bg-night text-white hover:bg-night-soft"
            }`}
          >
            Reservar
          </Link>
        </nav>
        <details className="group relative md:hidden">
          <summary
            className={`flex h-11 list-none items-center gap-2 rounded-full border px-4 text-[13px] font-medium [&::-webkit-details-marker]:hidden ${
              light ? "border-white/40 text-white" : "border-night/20 text-night"
            }`}
            aria-label="Abrir menu"
          >
            Menu
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-open:rotate-45" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M8 2v12M2 8h12" />
            </svg>
          </summary>
          <div className="absolute right-0 top-[52px] w-[min(320px,calc(100vw-32px))] rounded-2xl bg-white p-2 shadow-[0_20px_60px_-20px_rgba(8,27,54,0.45)] ring-1 ring-night/10">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="flex h-12 items-center rounded-xl px-4 text-[15px] text-night hover:bg-linen">
                {n.label}
              </Link>
            ))}
            <Link href="/reservar" className="mt-1 flex h-12 items-center justify-center rounded-xl bg-night text-[14px] font-semibold uppercase tracking-[0.12em] text-white">
              Escolher minha tenda
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas.");
  const ig = instagramUrl(settings.instagram);
  return (
    <footer className="bg-night text-white">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand tone="light" />
          <p className="mt-6 max-w-sm font-display text-2xl leading-snug text-white/90">Faça chuva ou faça sol.</p>
          <p className="mt-3 text-sm text-white/55">{settings.city}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Navegação</p>
          <ul className="mt-4 space-y-3 text-[15px] text-white/80">
            <li><Link href="/tendas" className="link-grow">Todas as tendas</Link></li>
            <li><Link href="/reservar" className="link-grow">Fazer uma reserva</Link></li>
            <li><Link href="/minha-reserva" className="link-grow">Consultar minha reserva</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Contato</p>
          <ul className="mt-4 space-y-3 text-[15px] text-white/80">
            {wa ? (
              <li>
                <a href={wa} target="_blank" rel="noopener noreferrer" className="link-grow">WhatsApp {formatPhone(settings.whatsappNumber ?? "")}</a>
              </li>
            ) : null}
            {settings.phones ? <li>{settings.phones}</li> : null}
            {ig ? (
              <li>
                <a href={ig} target="_blank" rel="noopener noreferrer" className="link-grow">Instagram {settings.instagram}</a>
              </li>
            ) : null}
            {settings.address ? <li>{settings.address}</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-4 py-6 text-xs text-white/40 sm:flex-row sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {settings.companyName}</span>
          <Link href="/login" className="hover:text-white/70">Acesso da equipe</Link>
        </div>
      </div>
    </footer>
  );
}
