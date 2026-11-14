-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'analista_sutl';
ALTER TYPE "RolUsuario" ADD VALUE 'proveedor';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "empresaActivaId" TEXT;

-- CreateTable
CREATE TABLE "analyst_grants" (
    "id" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "soloLectura" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "otorgadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadoAt" TIMESTAMP(3),

    CONSTRAINT "analyst_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analyst_grants_analystId_tenantId_key" ON "analyst_grants"("analystId", "tenantId");

-- CreateIndex
CREATE INDEX "analyst_grants_tenantId_idx" ON "analyst_grants"("tenantId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_grants" ADD CONSTRAINT "analyst_grants_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_grants" ADD CONSTRAINT "analyst_grants_otorgadoPorId_fkey" FOREIGN KEY ("otorgadoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_grants" ADD CONSTRAINT "analyst_grants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
