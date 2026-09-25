/**
 * Cria (ou redefine a senha de) um administrador.
 * Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="..." npm run admin:create
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Defina ADMIN_EMAIL com um e-mail válido.");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD precisa ter ao menos 10 caracteres.");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", active: true, sessionVersion: { increment: 1 } },
    create: { email, name, passwordHash, role: "ADMIN" },
  });
  console.log(`Administrador pronto: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
