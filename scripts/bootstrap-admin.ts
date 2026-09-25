/**
 * Cria o primeiro administrador a partir de ADMIN_EMAIL / ADMIN_PASSWORD, somente se o banco
 * ainda não tiver nenhum administrador. Rodar de novo não altera nada (a senha trocada no
 * sistema nunca é sobrescrita).
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins > 0) {
    console.log("Administrador já existe — nada a fazer.");
    return;
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) {
    console.log("Nenhum administrador e ADMIN_EMAIL/ADMIN_PASSWORD não definidos — crie um com `npm run admin:create`.");
    return;
  }
  await prisma.user.create({
    data: { email, name: process.env.ADMIN_NAME?.trim() || "Administrador", role: "ADMIN", passwordHash: await hashPassword(password) },
  });
  console.log(`Primeiro administrador criado: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
