/**
 * Seed mínimo: grava apenas as informações da empresa fornecidas pelo cliente.
 * Nenhum produto, preço, cliente ou locação é criado — tudo é cadastrado pelo administrador.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Universo Tendas",
      city: "Sinop - MT",
      phones: "(66) 3531-4760 · (66) 9 9982-4544",
      whatsappNumber: "5566999824544",
      instagram: "@universotendas",
      whatsappFooter: "Universo Tendas",
    },
  });
  console.log("Configurações da empresa gravadas.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
