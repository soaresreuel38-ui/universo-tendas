import { Prisma } from "@prisma/client";
import { can, type Permission, type Role } from "@/lib/domain";

/** Erro de regra de negócio: a mensagem é segura para mostrar ao usuário. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Você não tem permissão para esta operação.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Quem executa a operação (sempre vindo da sessão validada no servidor). */
export type Actor = { id: string; role: Role; name: string };

export function assertCan(actor: Actor, permission: Permission) {
  if (!can(actor.role, permission)) throw new ForbiddenError();
}

export type Db = Prisma.TransactionClient;

/**
 * Traduz violações das travas do banco (CHECK de estoque não negativo) em mensagem amigável.
 * Isso só acontece se duas operações concorrentes escaparem das validações da aplicação.
 */
export function translateDbError(error: unknown): never {
  if (error instanceof DomainError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  if (/_nonneg|violates check constraint/i.test(message)) {
    throw new DomainError("Estoque insuficiente: a operação deixaria o saldo negativo e foi bloqueada.");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new DomainError("Já existe um registro com esse valor (código/SKU ou e-mail duplicado).");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    throw new DomainError("Outra pessoa alterou este estoque ao mesmo tempo. Tente novamente.");
  }
  throw error;
}
