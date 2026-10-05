import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { PageHeader, Section } from "@/components/ui/primitives";
import { EXIT_TYPES, type ExitType } from "@/lib/domain";
import { toLocalInput } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { stockProductOptions } from "@/server/options";
import { stockExitAction } from "../actions";
import { ExitForm } from "../StockForms";

export const metadata: Metadata = { title: "Saída de estoque" };

const TYPES: Array<{ type: ExitType; icon: IconName; hint: string }> = [
  { type: "LOCACAO", icon: "tent", hint: "Cliente, evento e retorno previsto" },
  { type: "VENDA", icon: "cart", hint: "Sai definitivamente do estoque" },
  { type: "MANUTENCAO", icon: "wrench", hint: "Conserto; volta depois" },
  { type: "PERDA", icon: "alert", hint: "Baixa definitiva" },
  { type: "TRANSFERENCIA", icon: "truck", hint: "Para outro local" },
  { type: "OUTRO", icon: "arrowOut", hint: "Outro motivo" },
];

export default async function ExitPage({ searchParams }: { searchParams: Promise<{ tipo?: string; produto?: string }> }) {
  const user = await requirePermission("stock.exit");
  const { tipo, produto } = await searchParams;
  const kind = (["MANUTENCAO", "PERDA", "TRANSFERENCIA", "OUTRO"] as const).find((k) => k === tipo);
  const q = produto ? `&produto=${encodeURIComponent(produto)}` : "";
  const href = (t: ExitType) =>
    t === "LOCACAO" ? `/admin/locacoes/nova?saida=1${q}` : t === "VENDA" ? `/admin/vendas/nova${produto ? `?produto=${encodeURIComponent(produto)}` : ""}` : `/admin/estoque/saida?tipo=${t}${q}`;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="− Saída de estoque"
        description={`Escolha o tipo de saída. Responsável: ${user.name}.`}
        back={{ href: "/admin/produtos", label: "Estoque" }}
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TYPES.map((t) => {
          const active = kind === t.type;
          return (
            <Link
              key={t.type}
              href={href(t.type)}
              className={`rounded-lg border px-3 py-3 transition ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-line-strong"}`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon name={t.icon} className={`h-5 w-5 ${active ? "text-white" : "text-faint"}`} />
                {EXIT_TYPES[t.type]}
              </span>
              <span className={`mt-0.5 block text-xs ${active ? "text-white/70" : "text-faint"}`}>{t.hint}</span>
            </Link>
          );
        })}
      </div>
      {kind ? (
        <Section title={`Saída — ${EXIT_TYPES[kind]}`}>
          <ExitForm
            key={kind}
            action={stockExitAction}
            kind={kind}
            products={await stockProductOptions({ withUnits: true, withRemovable: true })}
            defaultProduct={produto}
            now={toLocalInput(new Date())}
          />
        </Section>
      ) : (
        <p className="text-sm text-faint">Locação e venda abrem os formulários completos, com cliente e valores.</p>
      )}
    </div>
  );
}
