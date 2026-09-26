import type { Permission } from "@/lib/domain";
import type { IconName } from "@/components/ui/icons";

export type NavItem = { href: string; label: string; icon: IconName; hint?: string; permission?: Permission };

/** Organizado pelo trabalho do dia: o que acontece hoje, a operação, o estoque, o comercial e a gestão. */
export const NAV_GROUPS: Array<{ title?: string; items: NavItem[] }> = [
  {
    title: "Início",
    items: [
      { href: "/admin/hoje", label: "Hoje", icon: "sun", hint: "Centro operacional do dia" },
      { href: "/admin", label: "Painel", icon: "home", hint: "Visão geral da empresa" },
    ],
  },
  {
    title: "Operação",
    items: [
      { href: "/admin/locacoes", label: "Locações", icon: "tent", hint: "Reservas, saídas e em andamento" },
      { href: "/admin/calendario", label: "Calendário", icon: "calendar" },
      { href: "/admin/retorno", label: "Retornos", icon: "undo", hint: "O que deveria voltar" },
      { href: "/admin/contratos", label: "Contratos", icon: "clipboard" },
      { href: "/admin/documentos", label: "Documentos", icon: "file" },
    ],
  },
  {
    title: "Estoque",
    items: [
      { href: "/admin/produtos", label: "Catálogo", icon: "grid", hint: "Tendas, estruturas e equipamentos" },
      { href: "/admin/estoque", label: "Estoque", icon: "layers", hint: "Distribuição por produto" },
      { href: "/admin/manutencao", label: "Manutenção", icon: "wrench", hint: "O que voltou com problema" },
      { href: "/admin/movimentacoes", label: "Movimentações", icon: "history", hint: "Histórico do estoque" },
    ],
  },
  {
    title: "Comercial",
    items: [
      { href: "/admin/clientes", label: "Clientes", icon: "users" },
      { href: "/admin/vendas", label: "Vendas", icon: "cart" },
      { href: "/admin/orcamentos", label: "Orçamentos", icon: "money", hint: "Aguardando aprovação do cliente" },
    ],
  },
  {
    title: "Análises",
    items: [{ href: "/admin/relatorios", label: "Relatórios", icon: "chart", permission: "report.view" }],
  },
  {
    title: "Configurações",
    items: [
      { href: "/admin/usuarios", label: "Usuários", icon: "users", permission: "user.manage" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "settings", permission: "settings.manage" },
    ],
  },
];

export const MOBILE_TABS: NavItem[] = [
  { href: "/admin/hoje", label: "Hoje", icon: "sun" },
  { href: "/admin/locacoes", label: "Locações", icon: "tent" },
  { href: "/admin/produtos", label: "Catálogo", icon: "grid" },
  { href: "/admin/menu", label: "Menu", icon: "menu" },
];

/** Ações de criação (botão "+" no celular e paleta de busca). */
export const CREATE_ACTIONS: Array<{ href: string; label: string; icon: IconName; hint: string; key?: string; permission?: Permission }> = [
  { href: "/admin/locacoes/nova", label: "Nova locação", icon: "tent", hint: "Cliente, período, produtos e contrato", key: "N" },
  { href: "/admin/locacoes/nova?saida=1", label: "Saída imediata", icon: "truck", hint: "Locação que sai agora" },
  { href: "/admin/vendas/nova", label: "Nova venda", icon: "cart", hint: "Venda com pagamento" },
  { href: "/admin/clientes/novo", label: "Novo cliente", icon: "users", hint: "Cadastro completo", key: "C" },
  { href: "/admin/contratos/novo", label: "Novo contrato", icon: "clipboard", hint: "A partir de uma locação" },
  { href: "/admin/estoque/entrada", label: "Entrada de estoque", icon: "arrowIn", hint: "Compra, devolução, ajuste", key: "E" },
  { href: "/admin/estoque/saida", label: "Saída de estoque", icon: "arrowOut", hint: "Perda, descarte, ajuste", key: "S" },
  { href: "/admin/retorno", label: "Conferir retorno", icon: "undo", hint: "Material que voltou", key: "R" },
];

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
