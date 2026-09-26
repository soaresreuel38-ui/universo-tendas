import type { Permission } from "@/lib/domain";
import type { IconName } from "@/components/ui/icons";

export type NavItem = { href: string; label: string; icon: IconName; hint?: string; permission?: Permission };

/** Organizado pela lógica do dia a dia: o que temos, o que sai, o que volta, o que foi vendido. */
export const NAV_GROUPS: Array<{ title?: string; items: NavItem[] }> = [
  {
    items: [
      { href: "/admin", label: "Painel", icon: "home" },
      { href: "/admin/hoje", label: "Hoje", icon: "clock", hint: "Saídas, retornos e pendências do dia" },
    ],
  },
  {
    title: "Operação",
    items: [
      { href: "/admin/produtos", label: "Estoque", icon: "box", hint: "O que temos" },
      { href: "/admin/locacoes", label: "Locações", icon: "tent", hint: "Reservas, saídas e em andamento" },
      { href: "/admin/contratos", label: "Contratos", icon: "clipboard" },
      { href: "/admin/calendario", label: "Calendário", icon: "calendar" },
      { href: "/admin/retorno", label: "Retornos", icon: "undo", hint: "O que deveria voltar" },
      { href: "/admin/manutencao", label: "Manutenção e pendências", icon: "wrench", hint: "O que voltou com problema" },
      { href: "/admin/vendas", label: "Vendas", icon: "cart", hint: "O que foi vendido" },
      { href: "/admin/clientes", label: "Clientes", icon: "users" },
      { href: "/admin/documentos", label: "Documentos", icon: "list" },
      { href: "/admin/movimentacoes", label: "Movimentações", icon: "history", hint: "Histórico do estoque" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/admin/relatorios", label: "Relatórios", icon: "chart", permission: "report.view" },
      { href: "/admin/usuarios", label: "Usuários", icon: "users", permission: "user.manage" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "settings", permission: "settings.manage" },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/admin", label: "Início", icon: "home" },
  { href: "/admin/hoje", label: "Hoje", icon: "clock" },
  { href: "/admin/locacoes", label: "Locações", icon: "tent" },
  { href: "/admin/produtos", label: "Estoque", icon: "box" },
  { href: "/admin/menu", label: "Menu", icon: "menu" },
];

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
