/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/br-documents";
import { whatsappLink } from "@/lib/format";
import { getSiteSettings, instagramUrl, type SiteSettings } from "@/server/site-data";
import { MenuCloser } from "./MenuCloser";

const NAV = [
  { href: "/#estruturas", label: "Estruturas" },
  { href: "/#empresa", label: "A empresa" },
  { href: "/tendas", label: "Catálogo" },
  { href: "/#contato", label: "Contato" },
];

/** Destino de "Solicitar orçamento": o pedido online entra direto no painel da empresa. */
export const QUOTE_HREF = "/reservar";

export function Brand({ tone = "light", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  const light = tone === "light";
  return (
    <span className="inline-flex items-center gap-2.5 sm:gap-3">
      <img src="/brand/universo-logo.png" alt="" width={40} height={40} className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
      <span className={`leading-tight ${light ? "text-white" : "text-night"}`}>
        <span className="block whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.08em] sm:text-[15px] sm:tracking-[0.16em]">Universo Tendas</span>
        {compact ? null : (
          <span className={`hidden whitespace-nowrap text-[11.5px] tracking-[0.04em] min-[440px]:block ${light ? "text-white/50" : "text-night/50"}`}>
            Estruturas para eventos · Sinop - MT
          </span>
        )}
      </span>
    </span>
  );
}

/** Cabeçalho escuro e fixo em todas as páginas do site, com o WhatsApp da empresa visível. */
export async function SiteHeader() {
  const settings = await getSiteSettings();
  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas.");
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-coal/95 text-white backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" aria-label="Universo Tendas — início" className="shrink-0">
          <Brand />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-8 xl:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="relative text-[14px] text-white/70 transition-colors duration-300 after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-brand after:transition-[width] after:duration-300 hover:text-white hover:after:w-full"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-6 lg:flex">
          {wa && settings.whatsappNumber ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-right text-[14px] leading-tight text-white/80 transition-colors hover:text-white">
              <span className="block text-[10.5px] uppercase tracking-[0.2em] text-brand">WhatsApp</span>
              {formatPhoneDisplay(settings.whatsappNumber)}
            </a>
          ) : null}
          <Link href={QUOTE_HREF} className="inline-flex h-11 items-center rounded-md bg-brand-logo px-5 text-[14px] font-semibold text-white transition-colors duration-300 hover:bg-brand-soft">
            Solicitar orçamento
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <Link href={QUOTE_HREF} className="inline-flex h-10 items-center rounded-md bg-brand-logo px-3 text-[13.5px] font-semibold text-white">
            Orçamento
          </Link>
          <details data-site-menu className="group relative shrink-0">
            <summary className="flex h-10 w-10 rounded-md list-none items-center justify-center border border-white/20 text-white [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
              <span className="relative block h-3 w-4" aria-hidden>
                <span className="absolute inset-x-0 top-0 h-[1.5px] bg-current transition-transform group-open:translate-y-[5px] group-open:rotate-45" />
                <span className="absolute inset-x-0 top-[5px] h-[1.5px] bg-current transition-opacity group-open:opacity-0" />
                <span className="absolute inset-x-0 bottom-0 h-[1.5px] bg-current transition-transform group-open:-translate-y-[5px] group-open:-rotate-45" />
              </span>
            </summary>
            <div className="fixed inset-x-0 top-[72px] z-40 h-[calc(100dvh-72px)] overflow-y-auto bg-coal px-5 pb-10 pt-4">
              <nav aria-label="Menu" className="divide-y divide-white/10 border-b border-white/10">
                {[...NAV, { href: "/minha-reserva", label: "Minha reserva" }].map((n) => (
                  <Link key={n.href} href={n.href} className="flex h-16 items-center justify-between text-[20px] font-medium text-white">
                    {n.label}
                    <span aria-hidden className="text-brand">→</span>
                  </Link>
                ))}
              </nav>
              {wa && settings.whatsappNumber ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-8 block text-white/80">
                  <span className="block text-[11px] uppercase tracking-[0.2em] text-brand">WhatsApp</span>
                  <span className="text-[20px]">{formatPhoneDisplay(settings.whatsappNumber)}</span>
                </a>
              ) : null}
            </div>
          </details>
        </div>
        <MenuCloser />
      </div>
    </header>
  );
}

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas.");
  const ig = instagramUrl(settings.instagram);
  const mapQuery = encodeURIComponent(`${settings.address ? `${settings.address}, ` : ""}${settings.city}`);
  return (
    <footer className="bg-coal text-white/75">
      <div className="mx-auto max-w-[1360px] px-5 sm:px-8">
        <div className="grid gap-12 border-b border-white/10 py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-10">
          <div>
            <Brand />
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-white/55">
              Locação de tendas e estruturas para eventos em Sinop e região, com montagem e desmontagem pela nossa equipe.
            </p>
            {ig ? (
              <a href={ig} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2.5 text-[14px] text-white/75 transition-colors hover:text-white">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
                </svg>
                {settings.instagram}
              </a>
            ) : null}
          </div>
          <FooterCol title="Navegação">
            <Link href="/#estruturas" className="hover:text-white">Estruturas</Link>
            <Link href="/tendas" className="hover:text-white">Catálogo</Link>
            <Link href={QUOTE_HREF} className="hover:text-white">Solicitar orçamento</Link>
            <Link href="/minha-reserva" className="hover:text-white">Minha reserva</Link>
          </FooterCol>
          <FooterCol title="Contato">
            {wa && settings.whatsappNumber ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                WhatsApp {formatPhoneDisplay(settings.whatsappNumber)}
              </a>
            ) : null}
            {settings.phones ? <span>Telefone {settings.phones.split("·")[0].trim()}</span> : null}
          </FooterCol>
          <FooterCol title="Localização">
            {settings.address ? <span>{settings.address}</span> : null}
            <span>{settings.city}</span>
            <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
              Ver no mapa
            </a>
          </FooterCol>
        </div>
        <div className="flex flex-col gap-2 py-6 text-[13px] text-white/40 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {settings.companyName} · {settings.city}</span>
          <Link href="/login" className="hover:text-white/70">Acesso da equipe</Link>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">{title}</p>
      <div className="mt-5 flex flex-col items-start gap-2.5 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}
