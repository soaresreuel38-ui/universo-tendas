/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatPhoneDisplay } from "@/lib/br-documents";
import { whatsappLink } from "@/lib/format";
import { getSiteSettings, instagramUrl, type SiteSettings } from "@/server/site-data";
import { HeaderScroll } from "./HeaderScroll";
import { ArrowRight, WhatsAppIcon } from "./Icons";
import { MenuCloser } from "./MenuCloser";

const NAV = [
  { href: "/#estruturas", label: "Estruturas" },
  { href: "/#aplicacoes", label: "Aplicações" },
  { href: "/#processo", label: "Como funciona" },
  { href: "/tendas", label: "Catálogo" },
  { href: "/#contato", label: "Contato" },
];

/** Destino de "Solicitar orçamento": o pedido online entra direto no painel da empresa. */
export const QUOTE_HREF = "/reservar";

export function Brand({ tone = "light", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  const light = tone === "light";
  return (
    <span className="inline-flex items-center gap-2.5 sm:gap-3">
      <img src="/brand/universo-logo.png" alt="" width={40} height={40} className="h-9 w-9 shrink-0 rounded-[2px] sm:h-10 sm:w-10" />
      <span className={`leading-tight ${light ? "text-white" : "text-night"}`}>
        <span className="block whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] sm:text-[16px]">Universo Tendas</span>
        {compact ? null : (
          <span className={`hidden whitespace-nowrap text-[12px] min-[440px]:block ${light ? "text-white/55" : "text-night/50"}`}>
            Estruturas para eventos em Sinop - MT
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Cabeçalho do site. `overlay`: transparente sobre a fotografia da capa (página inicial),
 * ganhando fundo ao rolar; nas demais páginas, barra azul-noite fixa.
 */
export async function SiteHeader({ overlay = false }: { overlay?: boolean } = {}) {
  const settings = await getSiteSettings();
  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas.");
  return (
    <header
      className={
        overlay
          ? "site-header-overlay fixed inset-x-0 top-0 z-30 border-b border-transparent text-white"
          : "sticky top-0 z-30 border-b border-white/[0.08] bg-abismo text-white"
      }
    >
      {overlay ? <HeaderScroll /> : null}
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8 lg:px-10">
        <Link href="/" aria-label="Universo Tendas — início" className="shrink-0">
          <Brand />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 xl:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="relative py-2 text-[14px] text-white/75 transition-colors duration-300 after:absolute after:bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-white after:transition-transform after:duration-500 after:ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-white hover:after:scale-x-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          {wa && settings.whatsappNumber ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[14px] text-white/80 transition-colors hover:text-white">
              <WhatsAppIcon className="h-4 w-4" />
              {formatPhoneDisplay(settings.whatsappNumber)}
            </a>
          ) : null}
          <Link
            href={QUOTE_HREF}
            className="inline-flex h-11 items-center gap-2 rounded-[3px] bg-white px-5 text-[14px] font-semibold text-tinta transition-colors duration-300 hover:bg-lona"
          >
            Solicitar orçamento
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
          <Link href={QUOTE_HREF} className="inline-flex h-10 items-center rounded-[3px] bg-white px-3 text-[13.5px] font-semibold text-tinta">
            Orçamento
          </Link>
          <details data-site-menu className="group relative shrink-0">
            <summary className="flex h-10 w-10 list-none items-center justify-center rounded-[3px] border border-white/30 text-white [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
              <span className="relative block h-3 w-4" aria-hidden>
                <span className="absolute inset-x-0 top-0 h-[1.5px] bg-current transition-transform group-open:translate-y-[5px] group-open:rotate-45" />
                <span className="absolute inset-x-0 top-[5px] h-[1.5px] bg-current transition-opacity group-open:opacity-0" />
                <span className="absolute inset-x-0 bottom-0 h-[1.5px] bg-current transition-transform group-open:-translate-y-[5px] group-open:-rotate-45" />
              </span>
            </summary>
            <div className="fixed inset-x-0 top-[72px] z-40 h-[calc(100dvh-72px)] overflow-y-auto bg-abismo px-5 pb-10 pt-4">
              <nav aria-label="Menu" className="divide-y divide-white/10 border-b border-white/10">
                {[...NAV, { href: "/minha-reserva", label: "Minha reserva" }].map((n) => (
                  <Link key={n.href} href={n.href} className="flex h-16 items-center justify-between text-[22px] font-medium tracking-[-0.01em] text-white">
                    {n.label}
                    <ArrowRight className="h-5 w-5 text-brand" />
                  </Link>
                ))}
              </nav>
              {wa && settings.whatsappNumber ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-3 text-[20px] text-white/85">
                  <WhatsAppIcon className="h-5 w-5 text-brand" />
                  {formatPhoneDisplay(settings.whatsappNumber)}
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

/** Rodapé enxuto: marca, navegação e contato. */
export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const wa = whatsappLink(settings.whatsappNumber, "Olá! Vim pelo site da Universo Tendas.");
  const ig = instagramUrl(settings.instagram);
  const mapQuery = encodeURIComponent(`${settings.address ? `${settings.address}, ` : ""}${settings.city}`);
  return (
    <footer className="bg-abismo text-white/70">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <div className="grid gap-10 border-b border-white/10 py-14 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <Brand />
            <p className="mt-5 max-w-xs text-[14.5px] leading-relaxed text-white/55">
              Locação de tendas e estruturas para eventos em Sinop e região, com montagem e desmontagem pela nossa equipe.
            </p>
          </div>
          <nav aria-label="Rodapé" className="flex flex-col gap-2.5 text-[14.5px] md:col-span-3">
            <Link href="/tendas" className="w-fit transition-colors hover:text-white">Catálogo de estruturas</Link>
            <Link href={QUOTE_HREF} className="w-fit transition-colors hover:text-white">Solicitar orçamento</Link>
            <Link href="/minha-reserva" className="w-fit transition-colors hover:text-white">Minha reserva</Link>
          </nav>
          <div className="flex flex-col gap-2.5 text-[14.5px] md:col-span-3">
            {wa && settings.whatsappNumber ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="w-fit transition-colors hover:text-white">
                WhatsApp {formatPhoneDisplay(settings.whatsappNumber)}
              </a>
            ) : null}
            {settings.phones ? <span>Telefone {settings.phones.split("·")[0].trim()}</span> : null}
            {ig ? (
              <a href={ig} target="_blank" rel="noopener noreferrer" className="w-fit transition-colors hover:text-white">
                Instagram {settings.instagram}
              </a>
            ) : null}
          </div>
          <div className="flex flex-col gap-2.5 text-[14.5px] md:col-span-2">
            {settings.address ? <span>{settings.address}</span> : null}
            <span>{settings.city}</span>
            <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="w-fit text-white underline decoration-brand decoration-[1.5px] underline-offset-4">
              Ver no mapa
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-2 py-6 text-[13px] text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {settings.companyName}, {settings.city}
          </span>
          <Link href="/login" className="hover:text-white">Acesso da equipe</Link>
        </div>
      </div>
    </footer>
  );
}
