import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { TentDrawing } from "@/components/brand/TentDrawing";
import { Icon, type IconName } from "./icons";

/*
 * Linguagem visual "Estrutura": papel neutro, grafite, linhas finas no lugar de caixas,
 * azul Universo só onde há ação e o vermelho da marca reservado para alertas.
 */

// ───────────────────────── Botões ─────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" | "lg" = "md") {
  const base =
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-[15px]" }[size];
  const variants = {
    primary: "bg-ink text-white shadow-[0_1px_0_rgba(8,44,92,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-soft",
    accent: "bg-accent text-white shadow-[0_1px_0_rgba(120,20,26,0.35)] hover:bg-accent-strong",
    secondary: "border border-line-strong bg-white text-graphite hover:border-[#bfbab0] hover:bg-paper",
    ghost: "text-muted hover:bg-black/[0.04] hover:text-graphite",
    danger: "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
  }[variant];
  return `${base} ${sizes} ${variants}`;
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  icon,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant, size)} ${className}`}>
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </Link>
  );
}

// ───────────────────────── Estrutura de página ─────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
  hero = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
  /** Topo azul da marca (telas principais). Os botões passam para a versão clara automaticamente. */
  hero?: boolean;
}) {
  if (hero) {
    return (
      <header className="relative mb-6 animate-rise overflow-hidden rounded-3xl bg-ink-deep text-white md:mb-8">
        <svg className="absolute inset-0 h-full w-full text-white/[0.05]" aria-hidden>
          <defs>
            <pattern id="hero-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0v28" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
        <TentDrawing className="pointer-events-none absolute -bottom-8 right-6 hidden w-[230px] text-white/[0.14] md:block lg:right-10" strokeWidth={1.2} />
        <div className="relative flex flex-col gap-5 px-6 py-6 sm:px-8 sm:py-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="min-w-0">
            {back ? (
              <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[13px] text-white/65 transition-colors hover:text-white">
                <Icon name="chevronLeft" className="h-4 w-4" />
                {back.label}
              </Link>
            ) : null}
            {eyebrow ? <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{eyebrow}</p> : null}
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] md:text-[34px]">{title}</h1>
            {description ? <p className="mt-1.5 max-w-2xl text-sm text-white/70">{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap gap-2 lg:mr-[200px] xl:mr-[230px] [&>a]:border [&>a]:border-white/25 [&>a]:bg-transparent [&>a]:text-white [&>a]:shadow-none [&>a:hover]:bg-white/10 [&>.bg-ink]:border-white [&>.bg-ink]:bg-white [&>.bg-ink]:font-semibold [&>.bg-ink]:text-ink [&>.bg-ink:hover]:bg-white/90">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
    );
  }
  return (
    <header className="mb-6 animate-rise md:mb-8">
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-graphite">
          <Icon name="chevronLeft" className="h-4 w-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-graphite md:text-[30px]">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Section({
  title,
  actions,
  children,
  className = "",
  padded = true,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 overflow-hidden rounded-2xl border border-line bg-white ${className}`}>
      {title ? (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-graphite">{title}</h2>
          {actions ? <div className="flex items-center gap-2 text-sm">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function EmptyState({ children, action, icon = "layers" }: { children: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center">
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-faint">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="max-w-sm text-sm text-muted">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const styles = {
    info: "border-line bg-paper text-graphite",
    warn: "border-amber-200 bg-amber-50/80 text-amber-950",
    danger: "border-red-200 bg-red-50/80 text-red-900",
    ok: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  }[tone];
  const icon: IconName = tone === "ok" ? "check" : tone === "info" ? "sparkle" : "alert";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex animate-rise items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ───────────────────────── Selos ─────────────────────────

export type Tone = "neutral" | "info" | "accent" | "warn" | "danger" | "ok" | "muted";

const DOT: Record<Tone, string> = {
  neutral: "bg-faint",
  muted: "bg-line-strong",
  info: "bg-st-reserved",
  accent: "bg-st-rented",
  warn: "bg-amber-500",
  danger: "bg-st-late",
  ok: "bg-st-free",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const text = {
    neutral: "text-graphite",
    muted: "text-faint",
    info: "text-[#244f8a]",
    accent: "text-[#8a5413]",
    warn: "text-amber-800",
    danger: "text-red-700",
    ok: "text-emerald-800",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-2 py-0.5 text-xs font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

export function StatusDot({ tone = "neutral", className = "" }: { tone?: Tone; className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]} ${className}`} aria-hidden />;
}

// ───────────────────────── Formulários ─────────────────────────

const control =
  "mt-1.5 block w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-graphite outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-[#bfbab0] focus:border-ink focus:ring-4 focus:ring-ink/10 disabled:bg-canvas disabled:text-faint";

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] font-medium text-graphite">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${control} pr-8 ${props.className ?? ""}`} />;
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-graphite">
      <input type="checkbox" {...props} className="h-4 w-4 rounded border-line-strong accent-[#0c3f80]" />
      {label}
    </label>
  );
}

// ───────────────────────── Tabela responsiva ─────────────────────────

export type Column<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** No celular: "title" vira o título do cartão, "hide" some, padrão aparece como linha rótulo/valor. */
  mobile?: "title" | "hide" | "meta";
  align?: "left" | "right" | "center";
};

/**
 * Tabela no computador; no celular cada linha vira um bloco compacto
 * (em vez de uma tabela espremida).
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  empty = "Nada por aqui ainda.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  const align = (c: Column<T>) => (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left");
  const titleCol = columns.find((c) => c.mobile === "title") ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c, i) => (
                <th key={i} className={`eyebrow px-5 py-3 font-semibold ${align(c)} ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="group transition-colors hover:bg-paper">
                {columns.map((c, i) => (
                  <td key={i} className={`px-5 py-3 align-middle ${align(c)} ${c.className ?? ""}`}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref(row)} className="font-medium text-graphite underline-offset-4 group-hover:underline">
                        {c.cell(row)}
                      </Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => {
          const content = (
            <>
              <div className="font-medium text-graphite">{titleCol.cell(row)}</div>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {columns
                  .filter((c) => c !== titleCol && c.mobile !== "hide")
                  .map((c, i) => (
                    <div key={i} className="contents">
                      <dt className="text-faint">{c.header}</dt>
                      <dd className="min-w-0 text-right text-graphite">{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link href={rowHref(row)} className="block px-4 py-3.5 active:bg-paper">
                  {content}
                </Link>
              ) : (
                <div className="px-4 py-3.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ───────────────────────── Indicadores ─────────────────────────

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "ok" | "info" | "warn";
  href?: string;
}) {
  const body = (
    <div className="h-full px-5 py-4">
      <p className="eyebrow flex items-center gap-2">
        <StatusDot tone={tone === "neutral" ? "muted" : tone} />
        {label}
      </p>
      <p className={`tabular mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] ${tone === "danger" && value ? "text-accent" : "text-graphite"}`}>{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-faint">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full transition-colors hover:bg-paper">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Faixa de indicadores separados por linhas finas (em vez de vários cartões). */
export function StatStrip({ children, cols = 5 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const grid = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" }[cols];
  return (
    <div className={`grid grid-cols-2 divide-line overflow-hidden rounded-2xl border border-line bg-white max-sm:divide-y sm:divide-x ${grid} [&>*:nth-child(odd)]:max-sm:border-r [&>*:last-child:nth-child(odd)]:max-sm:col-span-2 [&>*:last-child:nth-child(odd)]:max-sm:border-r-0 [&>*]:border-line`}>
      {children}
    </div>
  );
}

export function DefinitionList({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="eyebrow">{k}</dt>
          <dd className="mt-1 break-words text-graphite">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
