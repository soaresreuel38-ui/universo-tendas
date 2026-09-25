import type { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "./auth/password";
import { assertCan, DomainError, type Actor } from "./errors";

export const MIN_PASSWORD = 10;

export async function createUser(
  db: PrismaClient,
  actor: Actor,
  input: { name: string; email: string; password: string; role: Role },
) {
  assertCan(actor, "user.manage");
  if (input.password.length < MIN_PASSWORD) throw new DomainError(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) throw new DomainError("Já existe um usuário com este e-mail.");
  return db.user.create({
    data: { name: input.name.trim(), email, role: input.role, passwordHash: await hashPassword(input.password) },
  });
}

export async function updateUser(
  db: PrismaClient,
  actor: Actor,
  id: string,
  input: { name: string; email?: string; role: Role; active: boolean; password?: string | null },
) {
  assertCan(actor, "user.manage");
  if (id === actor.id && (input.role !== "ADMIN" || !input.active)) {
    throw new DomainError("Você não pode remover o próprio acesso de administrador.");
  }
  if (input.role !== "ADMIN" || !input.active) {
    const otherAdmins = await db.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
    if (otherAdmins === 0) throw new DomainError("É preciso manter ao menos um administrador ativo.");
  }
  const current = await db.user.findUnique({ where: { id } });
  if (!current) throw new DomainError("Usuário não encontrado.");
  const data: Parameters<typeof db.user.update>[0]["data"] = { name: input.name.trim(), role: input.role, active: input.active };
  const email = input.email?.trim().toLowerCase();
  if (email && email !== current.email) {
    if (await db.user.findUnique({ where: { email } })) throw new DomainError("Já existe um usuário com este e-mail.");
    data.email = email;
  }
  if (input.password) {
    if (input.password.length < MIN_PASSWORD) throw new DomainError(`A senha precisa ter ao menos ${MIN_PASSWORD} caracteres.`);
    data.passwordHash = await hashPassword(input.password);
  }
  // Troca de senha, papel ou desativação derruba as sessões abertas desse usuário.
  if (input.password || input.role !== current.role || !input.active) data.sessionVersion = { increment: 1 };
  return db.user.update({ where: { id }, data });
}
