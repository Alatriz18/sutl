-- AlterEnum
ALTER TYPE "CanalNotificacion" ADD VALUE 'whatsapp';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "destino" TEXT,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "intentos" INTEGER NOT NULL DEFAULT 0;

