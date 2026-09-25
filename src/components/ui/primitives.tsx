import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "./icons";

// ───────────────────────── Botões ─────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" | "lg" = "md") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" }[size];
  const variants = {
    primary: "bg-ink text-white hover:bg-ink-soft",
    accent: "bg-accent text-white hover:bg-accent-strong",
    secondary: "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50",
    ghost: "text-zinc-700 hover:bg-zinc-200/60",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
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
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-5 md:mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800">
          <Icon name="chevronLeft" className="h-4 w-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
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
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-zinc-500">
      <p>{children}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const styles = {
    info: "border-zinc-200 bg-zinc-50 text-zinc-700",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[tone];
  return <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

// ───────────────────────── Selos ─────────────────────────

export type Tone = "neutral" | "info" | "accent" | "warn" | "danger" | "ok" | "muted";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const styles = {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    muted: "bg-zinc-50 text-zinc-500 ring-zinc-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
    accent: "bg-amber-50 text-amber-800 ring-amber-200",
    warn: "bg-yellow-50 text-yellow-800 ring-yellow-300",
    danger: "bg-red-50 text-red-700 ring-red-200",
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  }[tone];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}>
      {children}
    </span>
  );
}

// ───────────────────────── Formulários ─────────────────────────

const control =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-xs outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500";

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
      <span className="text-sm font-medium text-zinc-700">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
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
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-zinc-800">
      <input type="checkbox" {...props} className="h-4 w-4 rounded border-zinc-300 accent-[#16171a]" />
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
 * Tabela no computador; no celular cada linha vira um cartão compacto
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
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500">
              {columns.map((c, i) => (
                <th key={i} className={`px-4 py-2.5 font-medium ${align(c)} ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="group hover:bg-zinc-50">
                {columns.map((c, i) => (
                  <td key={i} className={`px-4 py-2.5 align-middle ${align(c)} ${c.className ?? ""}`}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref(row)} className="font-medium text-zinc-900 hover:underline">
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
      <ul className="divide-y divide-zinc-100 md:hidden">
        {rows.map((row) => {
          const content = (
            <>
              <div className="font-medium text-zinc-900">{titleCol.cell(row)}</div>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                {columns
                  .filter((c) => c !== titleCol && c.mobile !== "hide")
                  .map((c, i) => (
                    <div key={i} className="contents">
                      <dt className="text-zinc-500">{c.header}</dt>
                      <dd className="min-w-0 text-right text-zinc-800">{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link href={rowHref(row)} className="block px-4 py-3 active:bg-zinc-50">
                  {content}
                </Link>
              ) : (
                <div className="px-4 py-3">{content}</div>
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
  const bar = {
    neutral: "bg-zinc-300",
    accent: "bg-accent",
    danger: "bg-red-500",
    ok: "bg-emerald-500",
    info: "bg-sky-500",
    warn: "bg-yellow-400",
  }[tone];
  const body = (
    <div className="relative h-full overflow-hidden rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold text-zinc-900 md:text-3xl">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-px">
      {body}
    </Link>
  ) : (
    body
  );
}

export function DefinitionList({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{k}</dt>
          <dd className="mt-0.5 break-words text-zinc-900">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
