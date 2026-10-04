import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { prisma } from "@/server/db";

/** Guia de início: aparece só enquanto há passos básicos pendentes. */
export async function FirstSteps({ isAdmin }: { isAdmin: boolean }) {
  const [template, productsWithPhoto, products, customers, rentals] = await Promise.all([
    prisma.contractTemplate.findUnique({ where: { id: "default" }, select: { cnpj: true, clauses: true } }),
    prisma.product.count({ where: { active: true, OR: [{ photoId: { not: null } }, { images: { some: {} } }] } }),
    prisma.product.count({ where: { active: true } }),
    prisma.customer.count(),
    prisma.rental.count(),
  ]);
  const clauses = Array.isArray(template?.clauses) ? template.clauses.length : 0;
  const steps = [
    ...(isAdmin
      ? [{ done: Boolean(template?.cnpj) && clauses > 0, title: "Dados da empresa e modelo de contrato", text: "CNPJ, endereço e as cláusulas que a empresa usa.", href: "/admin/configuracoes/contratos", cta: "Preencher" }]
      : []),
    { done: products > 0, title: "Cadastrar as tendas", text: "Nome, código, quantidade e preço da diária ou mensal.", href: "/admin/produtos/novo", cta: "Cadastrar produto" },
    { done: productsWithPhoto > 0, title: "Enviar as fotos reais", text: "Abra o produto e use “Galeria de fotos”.", href: "/admin/produtos", cta: "Abrir catálogo" },
    { done: customers > 0, title: "Cadastrar um cliente", text: "Ou cadastre direto ao fazer a locação.", href: "/admin/clientes/novo", cta: "Novo cliente" },
    { done: rentals > 0, title: "Fazer a primeira locação", text: "Diária ou mensal, em 4 passos.", href: "/admin/locacoes/nova", cta: "Nova locação" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  return (
    <section aria-label="Primeiros passos" className="animate-rise overflow-hidden rounded-2xl border border-ink/20 bg-white">
      <div className="flex flex-col gap-3 border-b border-line bg-ink-tint/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-graphite">Primeiros passos</p>
          <p className="text-sm text-muted">
            {doneCount} de {steps.length} concluídos. Próximo: <b className="font-medium text-graphite">{next.title}</b>
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white sm:w-48" aria-hidden>
          <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="divide-y divide-line/70">
        {steps.map((s, i) => (s.done ? null : (
          <li key={s.title} className="flex items-center gap-3 px-5 py-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s.done ? "bg-st-free text-white" : s === next ? "bg-ink text-white" : "border border-line-strong text-faint"
              }`}
            >
              {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-medium ${s.done ? "text-faint line-through" : "text-graphite"}`}>{s.title}</span>
              {s.done ? null : <span className="block text-xs text-faint">{s.text}</span>}
            </span>
            {s.done ? null : (
              <Link
                href={s.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium ${s === next ? "bg-ink text-white hover:bg-ink-soft" : "border border-line-strong text-graphite hover:bg-paper"}`}
              >
                {s.cta}
              </Link>
            )}
          </li>
        )))}
      </ol>
    </section>
  );
}
