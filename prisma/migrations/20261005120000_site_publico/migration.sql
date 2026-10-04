-- Site público: reservas online usando o mesmo estoque e a mesma regra de disponibilidade do painel.
-- Somente acréscimos (colunas opcionais ou com valor padrão). Nenhum dado existente é alterado,
-- exceto "Rental"."createdById", que deixa de ser obrigatório (reservas do site não têm usuário do painel).

-- CreateEnum
CREATE TYPE "RentalSource" AS ENUM ('ADMIN', 'SITE', 'WHATSAPP', 'OUTRO');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('PF', 'PJ');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "personType" "PersonType" NOT NULL DEFAULT 'PF',
ADD COLUMN     "tradeName" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showOnSite" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "cancelRequestReason" TEXT,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3),
ADD COLUMN     "eventCity" TEXT,
ADD COLUMN     "eventComplement" TEXT,
ADD COLUMN     "eventDistrict" TEXT,
ADD COLUMN     "eventEndAt" TIMESTAMP(3),
ADD COLUMN     "eventNotes" TEXT,
ADD COLUMN     "eventNumber" TEXT,
ADD COLUMN     "eventState" TEXT,
ADD COLUMN     "eventStreet" TEXT,
ADD COLUMN     "eventZipCode" TEXT,
ADD COLUMN     "pricePending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicTokenHash" TEXT,
ADD COLUMN     "source" "RentalSource" NOT NULL DEFAULT 'ADMIN',
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "onlineAutoConfirm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onlineBufferDaysAfter" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "onlineBufferDaysBefore" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_publicTokenHash_key" ON "Rental"("publicTokenHash");

-- CreateIndex
CREATE INDEX "Rental_source_status_idx" ON "Rental"("source", "status");

-- Travas de integridade (mesmo padrão das demais: o banco recusa valores inválidos).
ALTER TABLE "BusinessSettings"
  ADD CONSTRAINT "BusinessSettings_buffer_before_range" CHECK ("onlineBufferDaysBefore" BETWEEN 0 AND 30),
  ADD CONSTRAINT "BusinessSettings_buffer_after_range" CHECK ("onlineBufferDaysAfter" BETWEEN 0 AND 30);
