/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/br-documents";
import { whatsappLink } from "@/lib/format";
import { getSiteSettings, instagramUrl, type SiteSettings } from "@/server/site-data";
import { MenuCloser } from "./MenuCloser";

const NAV = [
  { href: "/tendas", label: "Tendas" },
  { href: "/#como-solicitar", label: "Como solicitar" },
  { href: "/#empresa", label: "A empresa" },
  { href: "/#contato", label: "Contato" },
];

/** Destino de "Solicitar orçamento": o pedido online entra direto no painel da empresa. */
export const QUOTE_HREF = "/reservar";

export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src="/brand/universo-logo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
      <span className={`leading-tight ${tone === "light" ? "text-white" : "text-night"}`}>
        <span className="block whitespace-nowrap text-[16px] font-semibold tracking-[-0.01em]">Universo Tendas</span>
        <span className={`whitespace-nowrap text-[12.5px] ${tone === "light" ? "block text-white/55" : "hidden text-night/55 min-[440px]:block"}`}>Locação de tendas · Sinop - MT</span>
      </span>
    </span>
  );
}

/** Cabeçalho branco e fixo em todas as páginas do site, com o WhatsApp da empresa visível. */
export async function SiteHeader() {
  const settings = await getSiteSettings();
  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas.");
  return (
    <header className="sticky top-0 z-30 border-b border-night/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="Universo Tendas — início" className="shrink-0">
          <Brand />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[15px] text-night/75 transition-colors hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          {wa && settings.whatsappNumber ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-[14px] leading-tight text-night/75 hover:text-ink">
              <span className="block text-[11.5px] text-night/45">WhatsApp</span>
              {formatPhoneDisplay(settings.whatsappNumber)}
            </a>
          ) : null}
          <Link href={QUOTE_HREF} className="inline-flex h-11 items-center bg-ink px-5 text-[14.5px] font-medium text-white transition-colors hover:bg-ink-deep">
            Solicitar orçamento
          </Link>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Link href={QUOTE_HREF} className="inline-flex h-10 items-center bg-ink px-3.5 text-[14px] font-medium text-white">
            Orçamento
          </Link>
          <details data-site-menu className="group relative shrink-0">
            <summary className="flex h-10 w-11 list-none items-center justify-center border border-night/15 text-night [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
              <span className="relative block h-3 w-4" aria-hidden>
                <span className="absolute inset-x-0 top-0 h-[1.5px] bg-current transition-transform group-open:translate-y-[5px] group-open:rotate-45" />
                <span className="absolute inset-x-0 top-[5px] h-[1.5px] bg-current transition-opacity group-open:opacity-0" />
                <span className="absolute inset-x-0 bottom-0 h-[1.5px] bg-current transition-transform group-open:-translate-y-[5px] group-open:-rotate-45" />
              </span>
            </summary>
            <div className="fixed inset-x-0 top-[72px] z-40 border-t border-night/10 bg-white px-5 pb-8 pt-2 shadow-[0_24px_40px_-24px_rgba(0,0,0,0.25)]">
              <nav aria-label="Menu" className="divide-y divide-night/10">
                {[...NAV, { href: "/minha-reserva", label: "Minha reserva" }].map((n) => (
                  <Link key={n.href} href={n.href} className="flex h-14 items-center text-[17px] text-night">
                    {n.label}
                  </Link>
                ))}
              </nav>
              {wa && settings.whatsappNumber ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-4 block border-t border-night/10 pt-4 text-[15px] text-night/70">
                  WhatsApp {formatPhoneDisplay(settings.whatsappNumber)}
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
    <footer className="bg-[#16181d] text-white/80">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 text-[14.5px] leading-relaxed sm:px-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Brand tone="light" />
          <p className="mt-5 max-w-xs text-white/55">Locação de tendas e estruturas para eventos em Sinop e região.</p>
        </div>
        <div>
          <p className="text-white/45">Endereço</p>
          <p className="mt-2">
            {settings.address ? <span className="block">{settings.address}</span> : null}
            <span className="block">{settings.city}</span>
          </p>
          <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
            Ver no mapa
          </a>
        </div>
        <div>
          <p className="text-white/45">Telefones</p>
          <p className="mt-2">
            {settings.phones ? <span className="block">{settings.phones.split("·")[0].trim()}</span> : null}
            {wa && settings.whatsappNumber ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="block hover:text-white">
                WhatsApp {formatPhoneDisplay(settings.whatsappNumber)}
              </a>
            ) : null}
          </p>
          {ig ? (
            <a href={ig} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block hover:text-white">
              {settings.instagram}
            </a>
          ) : null}
        </div>
        <div>
          <p className="text-white/45">Site</p>
          <p className="mt-2 flex flex-col">
            <Link href="/tendas" className="hover:text-white">Tendas</Link>
            <Link href={QUOTE_HREF} className="hover:text-white">Solicitar orçamento</Link>
            <Link href="/minha-reserva" className="hover:text-white">Minha reserva</Link>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-5 py-5 text-[13px] text-white/40 sm:flex-row sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} {settings.companyName} · {settings.city}</span>
          <Link href="/login" className="hover:text-white/70">Acesso da equipe</Link>
        </div>
      </div>
    </footer>
  );
}
