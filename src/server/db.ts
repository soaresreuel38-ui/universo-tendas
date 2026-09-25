import { PrismaClient } from "@prisma/client";

// A integração Neon da Vercel usa DATABASE_URL_UNPOOLED para a conexão direta.
process.env.DIRECT_URL ||= process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
