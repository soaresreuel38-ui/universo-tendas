-- CreateEnum
CREATE TYPE "RentalBilling" AS ENUM ('DIARIA', 'MENSAL');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "monthlyPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "billingMode" "RentalBilling" NOT NULL DEFAULT 'DIARIA',
ADD COLUMN     "periodCount" INTEGER NOT NULL DEFAULT 1;

-- Regras de integridade
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_periodCount_positive" CHECK ("periodCount" > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_monthlyPrice_nonneg" CHECK ("monthlyPriceCents" IS NULL OR "monthlyPriceCents" >= 0);
