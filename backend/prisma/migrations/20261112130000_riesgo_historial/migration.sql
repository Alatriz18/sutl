-- CreateTable
CREATE TABLE "risk_states" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "semaforo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "evaluadoAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_changes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "desde" TEXT,
    "hacia" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "fechaQuiebre" TIMESTAMP(3),
    "avisado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "risk_states_tenantId_sku_key" ON "risk_states"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "risk_changes_tenantId_createdAt_idx" ON "risk_changes"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "risk_states" ADD CONSTRAINT "risk_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_changes" ADD CONSTRAINT "risk_changes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
