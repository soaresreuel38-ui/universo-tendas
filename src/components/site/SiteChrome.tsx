/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/br-documents";
import { whatsappLink } from "@/lib/format";
import { instagramUrl, type SiteSettings } from "@/server/site-data";
import { MenuCloser } from "./MenuCloser";

const NAV = [
  { href: "/tendas", label: "Tendas" },
  { href: "/#solucoes", label: "Soluções" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#sobre", label: "Sobre nós" },
  { href: "/#contato", label: "Contato" },
];

/** Destino de "Solicitar orçamento": o pedido online entra direto no painel da empresa. */
export const QUOTE_HREF = "/reservar";

export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src="/brand/universo-logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[6px]" />
      <span className={`leading-none ${tone === "light" ? "text-white" : "text-night"}`}>
        <span className="block whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.14em] sm:text-[15px] sm:tracking-[0.18em]">Universo Tendas</span>
        <span className={`mt-1.5 block whitespace-nowrap text-[8.5px] font-medium uppercase tracking-[0.22em] sm:text-[9.5px] sm:tracking-[0.28em] ${tone === "light" ? "text-white/55" : "text-night/45"}`}>
          Estruturas para eventos
        </span>
      </span>
    </span>
  );
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const light = overlay;
  return (
    <header className={overlay ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b border-night/10 bg-linen/90 backdrop-blur"}>
      <div className={`mx-auto flex h-[76px] max-w-[1360px] items-center justify-between gap-3 px-5 sm:gap-6 sm:px-10 ${overlay ? "border-b border-white/15" : ""}`}>
        <Link href="/" aria-label="Universo Tendas — início" className="shrink-0">
          <Brand tone={light ? "light" : "dark"} />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`link-grow text-[12px] font-medium uppercase tracking-[0.16em] ${light ? "text-white/80 hover:text-white" : "text-night/70 hover:text-night"}`}
            >
              {n.label}
            </Link>
          ))}
          <Link
            href={QUOTE_HREF}
            className={`inline-flex h-11 items-center px-6 text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors ${
              light ? "bg-white text-night hover:bg-linen" : "bg-night text-white hover:bg-night-soft"
            }`}
          >
            Solicitar orçamento
          </Link>
        </nav>
        <details data-site-menu className="group relative shrink-0 lg:hidden">
          <summary
            className={`flex h-11 list-none items-center gap-2.5 border px-4 text-[12px] font-medium uppercase tracking-[0.16em] [&::-webkit-details-marker]:hidden ${
              light ? "border-white/35 text-white" : "border-night/20 text-night"
            }`}
            aria-label="Abrir menu"
          >
            Menu
            <span className="relative block h-2.5 w-3.5" aria-hidden>
              <span className="absolute inset-x-0 top-0 h-px bg-current transition-transform group-open:translate-y-[5px] group-open:rotate-45" />
              <span className="absolute inset-x-0 bottom-0 h-px bg-current transition-transform group-open:-translate-y-[4px] group-open:-rotate-45" />
            </span>
          </summary>
          <div className="fixed inset-x-0 top-[76px] z-40 border-t border-night/10 bg-linen px-5 pb-8 pt-4 shadow-[0_30px_60px_-30px_rgba(8,27,54,0.5)]">
            <nav aria-label="Menu" className="divide-y divide-night/10">
              {[...NAV, { href: "/minha-reserva", label: "Minha reserva" }].map((n) => (
                <Link key={n.href} href={n.href} className="flex h-14 items-center justify-between text-[15px] uppercase tracking-[0.12em] text-night">
                  {n.label}
                  <span aria-hidden className="text-night/30">→</span>
                </Link>
              ))}
            </nav>
            <Link href={QUOTE_HREF} className="mt-6 flex h-14 items-center justify-center bg-night text-[13px] font-semibold uppercase tracking-[0.16em] text-white">
              Solicitar orçamento
            </Link>
          </div>
        </details>
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
    <footer className="bg-[#05101f] text-white">
      <div className="mx-auto grid max-w-[1360px] gap-12 px-5 py-16 sm:px-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Brand tone="light" />
          <p className="mt-6 max-w-xs text-[14px] leading-relaxed text-white/55">
            Locação de tendas e estruturas para eventos, empresas e grandes projetos em Sinop e região.
          </p>
        </div>
        <FooterCol title="Navegação">
          <Link href="/tendas" className="link-grow">Tendas</Link>
          <Link href={QUOTE_HREF} className="link-grow">Solicitar orçamento</Link>
          <Link href="/minha-reserva" className="link-grow">Minha reserva</Link>
        </FooterCol>
        <FooterCol title="Endereço">
          {settings.address ? <span>{settings.address}</span> : null}
          <span>{settings.city}</span>
          <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="link-grow text-white/55">
            Ver no mapa
          </a>
        </FooterCol>
        <FooterCol title="Contato">
          {settings.phones ? <span>{settings.phones}</span> : null}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="link-grow">
              WhatsApp {formatPhoneDisplay(settings.whatsappNumber ?? "")}
            </a>
          ) : null}
          {ig ? (
            <a href={ig} target="_blank" rel="noopener noreferrer" className="link-grow">
              Instagram {settings.instagram}
            </a>
          ) : null}
        </FooterCol>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-5 py-6 text-[11px] uppercase tracking-[0.16em] text-white/35 sm:flex-row sm:justify-between sm:px-10">
          <span>© {new Date().getFullYear()} {settings.companyName}</span>
          <Link href="/login" className="hover:text-white/70">Acesso da equipe</Link>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-white/40">{title}</p>
      <div className="mt-5 flex flex-col items-start gap-2.5 text-[14px] leading-relaxed text-white/80">{children}</div>
    </div>
  );
}
