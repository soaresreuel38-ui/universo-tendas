/**
 * Regras e rótulos do domínio que podem ser usados tanto no servidor quanto no navegador.
 * Os valores espelham os enums do Prisma (prisma/schema.prisma).
 */

export type Role = "ADMIN" | "EMPLOYEE";
export type ProductKind = "RENTAL" | "SALE" | "BOTH";
export type TrackingMode = "QUANTITY" | "UNIT";
export type RentalStatus =
  | "ORCAMENTO"
  | "RESERVADA"
  | "CONFIRMADA"
  | "SEPARACAO"
  | "SAIU"
  | "EM_EVENTO"
  | "AGUARDANDO_RETORNO"
  | "ATRASADA"
  | "RETORNADA"
  | "CONFERIDA"
  | "FINALIZADA"
  | "CANCELADA";

export const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administrador", EMPLOYEE: "Funcionário" };

export const KIND_LABEL: Record<ProductKind, string> = {
  RENTAL: "Locação",
  SALE: "Venda",
  BOTH: "Locação e venda",
};

export const TRACKING_LABEL: Record<TrackingMode, string> = {
  QUANTITY: "Por quantidade",
  UNIT: "Por unidade (numeradas)",
};

export const RENTAL_STATUS_LABEL: Record<RentalStatus, string> = {
  ORCAMENTO: "Orçamento",
  RESERVADA: "Reservada",
  CONFIRMADA: "Confirmada",
  SEPARACAO: "Separação",
  SAIU: "Saiu",
  EM_EVENTO: "Em evento",
  AGUARDANDO_RETORNO: "Aguardando retorno",
  ATRASADA: "Atrasada",
  RETORNADA: "Retornada",
  CONFERIDA: "Conferida",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

/** Reservam estoque, mas os produtos ainda estão no depósito. */
export const RESERVING_STATUSES = ["RESERVADA", "CONFIRMADA", "SEPARACAO"] as const satisfies RentalStatus[];
/** Produtos fora do depósito (ou de volta, mas ainda sem conferência). */
export const OUT_STATUSES = ["SAIU", "EM_EVENTO", "AGUARDANDO_RETORNO", "ATRASADA", "RETORNADA"] as const satisfies RentalStatus[];
/** Comprometem estoque no cálculo de disponibilidade por data. */
export const COMMITTING_STATUSES = [...RESERVING_STATUSES, ...OUT_STATUSES] as RentalStatus[];
/** Itens e datas ainda podem ser alterados. */
export const EDITABLE_STATUSES = ["ORCAMENTO", ...RESERVING_STATUSES] as RentalStatus[];
/** Podem receber a conferência de retorno. */
export const CHECKIN_STATUSES = [...OUT_STATUSES] as RentalStatus[];

export const isReserving = (s: RentalStatus) => (RESERVING_STATUSES as readonly string[]).includes(s);
export const isOut = (s: RentalStatus) => (OUT_STATUSES as readonly string[]).includes(s);

/**
 * Transições manuais permitidas. SAIU (saída do estoque) e CONFERIDA (conferência)
 * têm telas próprias porque movimentam o estoque.
 */
export const RENTAL_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  ORCAMENTO: ["RESERVADA", "CONFIRMADA", "SAIU", "CANCELADA"],
  RESERVADA: ["CONFIRMADA", "SEPARACAO", "SAIU", "CANCELADA"],
  CONFIRMADA: ["SEPARACAO", "SAIU", "CANCELADA"],
  SEPARACAO: ["CONFIRMADA", "SAIU", "CANCELADA"],
  SAIU: ["EM_EVENTO", "AGUARDANDO_RETORNO", "RETORNADA", "CONFERIDA"],
  EM_EVENTO: ["AGUARDANDO_RETORNO", "RETORNADA", "CONFERIDA"],
  AGUARDANDO_RETORNO: ["RETORNADA", "CONFERIDA"],
  ATRASADA: ["RETORNADA", "CONFERIDA"],
  RETORNADA: ["CONFERIDA"],
  CONFERIDA: ["FINALIZADA"],
  FINALIZADA: [],
  CANCELADA: [],
};

export function canTransition(from: RentalStatus, to: RentalStatus): boolean {
  return RENTAL_TRANSITIONS[from].includes(to);
}

/**
 * Status exibido: locações fora do depósito com retorno previsto já vencido aparecem como ATRASADA.
 * Assim não é preciso nenhuma tarefa agendada para "virar" o status.
 */
export function effectiveStatus(
  r: { status: RentalStatus; expectedReturnAt: Date },
  now: Date = new Date(),
): RentalStatus {
  if ((r.status === "SAIU" || r.status === "EM_EVENTO" || r.status === "AGUARDANDO_RETORNO") && r.expectedReturnAt < now) {
    return "ATRASADA";
  }
  return r.status;
}

export const isOverdue = (r: { status: RentalStatus; expectedReturnAt: Date }, now: Date = new Date()) =>
  effectiveStatus(r, now) === "ATRASADA";

/** Tons neutros com destaque apenas onde exige atenção. */
export const RENTAL_STATUS_TONE: Record<RentalStatus, "neutral" | "info" | "accent" | "warn" | "danger" | "ok" | "muted"> = {
  ORCAMENTO: "muted",
  RESERVADA: "info",
  CONFIRMADA: "info",
  SEPARACAO: "accent",
  SAIU: "accent",
  EM_EVENTO: "accent",
  AGUARDANDO_RETORNO: "warn",
  ATRASADA: "danger",
  RETORNADA: "warn",
  CONFERIDA: "ok",
  FINALIZADA: "ok",
  CANCELADA: "muted",
};

// ───────────────────────── Movimentações ─────────────────────────

export type MovementType =
  | "ENTRADA"
  | "SAIDA_LOCACAO"
  | "RETORNO_LOCACAO"
  | "VENDA"
  | "VENDA_CANCELADA"
  | "ENVIO_MANUTENCAO"
  | "RETORNO_MANUTENCAO"
  | "DESCARTE_MANUTENCAO"
  | "DANIFICADO_RETORNO"
  | "PENDENCIA"
  | "PENDENCIA_ENCONTRADA"
  | "PENDENCIA_PERDIDA"
  | "PERDA"
  | "TRANSFERENCIA"
  | "SAIDA_OUTRA"
  | "AJUSTE";

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  ENTRADA: "Entrada",
  SAIDA_LOCACAO: "Saída p/ locação",
  RETORNO_LOCACAO: "Retorno de locação",
  VENDA: "Venda",
  VENDA_CANCELADA: "Venda cancelada",
  ENVIO_MANUTENCAO: "Envio p/ manutenção",
  RETORNO_MANUTENCAO: "Retorno de manutenção",
  DESCARTE_MANUTENCAO: "Descarte (manutenção)",
  DANIFICADO_RETORNO: "Danificado no retorno",
  PENDENCIA: "Faltante (pendência)",
  PENDENCIA_ENCONTRADA: "Pendência encontrada",
  PENDENCIA_PERDIDA: "Pendência baixada (perda)",
  PERDA: "Perda",
  TRANSFERENCIA: "Transferência",
  SAIDA_OUTRA: "Saída (outro)",
  AJUSTE: "Ajuste de inventário",
};

export const ENTRY_REASONS = {
  COMPRA: "Compra",
  DEVOLUCAO: "Devolução",
  AJUSTE: "Ajuste",
  OUTRO: "Outro",
} as const;
export type EntryReason = keyof typeof ENTRY_REASONS;

export const EXIT_TYPES = {
  LOCACAO: "Locação",
  VENDA: "Venda",
  MANUTENCAO: "Manutenção",
  PERDA: "Perda",
  TRANSFERENCIA: "Transferência",
  OUTRO: "Outro",
} as const;
export type ExitType = keyof typeof EXIT_TYPES;

// ───────────────────────── Permissões ─────────────────────────

export type Permission =
  | "product.manage"
  | "stock.entry"
  | "stock.exit"
  | "stock.adjust"
  | "rental.manage"
  | "rental.checkin"
  | "sale.create"
  | "sale.cancel"
  | "customer.manage"
  | "maintenance.close"
  | "maintenance.discard"
  | "pending.found"
  | "pending.lost"
  | "report.view"
  | "user.manage"
  | "settings.manage";

const EMPLOYEE_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "stock.entry",
  "stock.exit",
  "rental.manage",
  "rental.checkin",
  "sale.create",
  "customer.manage",
  "maintenance.close",
  "pending.found",
]);

export function can(role: Role, permission: Permission): boolean {
  if (role === "ADMIN") return true;
  return EMPLOYEE_PERMISSIONS.has(permission);
}
