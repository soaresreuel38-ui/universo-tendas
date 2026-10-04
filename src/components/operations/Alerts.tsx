import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";

export type AlertItem = {
  count: number;
  label: string;
  href: string;
  tone: "danger" | "warn" | "info";
  icon: IconName;
  detail?: string;
  /** Alerta sem quantidade (ex.: configuração pendente): mostra o ícone no lugar do número. */
  flag?: boolean;
};

/** Lista de alertas: só o que pede ação, do mais urgente ao informativo. */
export function AlertList({ items }: { items: AlertItem[] }) {
  const visible = items.filter((a) => a.flag || a.count > 0);
  if (!visible.length) {
    return (
      <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-st-free">
          <Icon name="check" className="h-4 w-4" />
        </span>
        Tudo em dia. Nenhuma pendência agora.
      </div>
    );
  }
  const order = { danger: 0, warn: 1, info: 2 };
  return (
    <ul className="divide-y divide-line/70">
      {visible
        .sort((a, b) => order[a.tone] - order[b.tone])
        .map((a) => (
          <li key={a.label}>
            <Link href={a.href} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-paper">
              <span
                className={`tabular flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[15px] font-semibold ${
                  a.tone === "danger" ? "bg-accent-soft text-accent" : a.tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-canvas text-graphite"
                }`}
              >
                {a.flag ? <Icon name={a.icon} className="h-4 w-4" /> : a.count}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-graphite">{a.label}</span>
                {a.detail ? <span className="block truncate text-xs text-faint">{a.detail}</span> : null}
              </span>
              <Icon name="chevronRight" className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
    </ul>
  );
}

type AlertSource = {
  overdue: unknown[];
  departures: Array<{ departureAt: Date }>;
  returns: unknown[];
  awaitingCheck: unknown[];
  contractsAwaiting: unknown[];
  contractsToGenerate: unknown[];
  pendingPayments: Array<{ openCents: number }>;
  openQuotes: number;
  maintenanceUnits?: number;
  lowStock?: number;
  onlinePending?: number;
  cancelRequests?: number;
};

export function operationalAlerts(d: AlertSource, money: (c: number) => string, now = new Date()): AlertItem[] {
  const lateDepartures = d.departures.filter((r) => r.departureAt < now).length;
  const open = d.pendingPayments.reduce((s, p) => s + p.openCents, 0);
  return [
    { count: d.onlinePending ?? 0, label: "Novas reservas online", detail: "Aguardando sua aprovação (estoque já reservado)", href: "/admin/locacoes?aba=site", tone: "danger", icon: "calendar" },
    { count: d.cancelRequests ?? 0, label: "Pedidos de cancelamento do site", detail: "O estoque só é liberado quando você cancelar", href: "/admin/locacoes?aba=cancelamento", tone: "warn", icon: "alert" },
    { count: d.overdue.length, label: "Locações atrasadas", detail: "Retorno previsto já passou", href: "/admin/locacoes?aba=atrasadas", tone: "danger", icon: "alert" },
    { count: lateDepartures, label: "Saídas com horário vencido", detail: "Ainda não registradas", href: "/admin/locacoes?aba=saidas", tone: "danger", icon: "truck" },
    { count: d.contractsAwaiting.length, label: "Contratos aguardando assinatura", href: "/admin/contratos?aba=assinatura", tone: "warn", icon: "clipboard" },
    { count: d.contractsToGenerate.length, label: "Reservas sem contrato", detail: "Gerar a partir da locação", href: "/admin/contratos/novo", tone: "warn", icon: "file" },
    { count: d.awaitingCheck.length, label: "Retornos aguardando conferência", href: "/admin/retorno", tone: "warn", icon: "undo" },
    { count: d.returns.length, label: "Devoluções previstas hoje", href: "/admin/hoje?f=retorno", tone: "info", icon: "undo" },
    { count: d.pendingPayments.length, label: "Pagamentos pendentes", detail: open ? `${money(open)} em aberto` : undefined, href: "/admin/locacoes?aba=ativas", tone: "info", icon: "money" },
    { count: d.maintenanceUnits ?? 0, label: "Itens em manutenção", href: "/admin/manutencao", tone: "info", icon: "wrench" },
    { count: d.lowStock ?? 0, label: "Produtos com estoque baixo", href: "/admin/estoque?filtro=baixo", tone: "warn", icon: "layers" },
    { count: d.openQuotes, label: "Orçamentos aguardando aprovação", href: "/admin/orcamentos", tone: "info", icon: "money" },
  ];
}
