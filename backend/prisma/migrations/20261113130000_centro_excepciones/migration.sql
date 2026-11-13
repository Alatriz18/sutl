-- CreateEnum
CREATE TYPE "SeveridadExcepcion" AS ENUM ('media', 'alta', 'critica');

-- CreateEnum
CREATE TYPE "EstadoExcepcion" AS ENUM ('abierta', 'resuelta');

-- CreateTable
CREATE TABLE "exception_cases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "severidad" "SeveridadExcepcion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "estado" "EstadoExcepcion" NOT NULL DEFAULT 'abierta',
    "taskId" TEXT,
    "venceSlaAt" TIMESTAMP(3) NOT NULL,
    "escaladaAt" TIMESTAMP(3),
    "resueltaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exception_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exception_cases_tenantId_tipo_clave_key" ON "exception_cases"("tenantId", "tipo", "clave");

-- CreateIndex
CREATE INDEX "exception_cases_tenantId_estado_idx" ON "exception_cases"("tenantId", "estado");

-- AddForeignKey
ALTER TABLE "exception_cases" ADD CONSTRAINT "exception_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
