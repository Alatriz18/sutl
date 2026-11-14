-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('pendiente', 'aprobado', 'rechazado');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "estado" "EstadoDocumento" NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "motivoRechazo" TEXT,
ADD COLUMN     "revisadoPorId" TEXT,
ADD COLUMN     "revisadoAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "documents_tenantId_fechaVencimiento_idx" ON "documents"("tenantId", "fechaVencimiento");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
