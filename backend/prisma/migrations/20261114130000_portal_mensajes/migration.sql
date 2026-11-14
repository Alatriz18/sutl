-- CreateTable
CREATE TABLE "portal_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_messages_tenantId_entidadTipo_entidadId_createdAt_idx" ON "portal_messages"("tenantId", "entidadTipo", "entidadId", "createdAt");

-- AddForeignKey
ALTER TABLE "portal_messages" ADD CONSTRAINT "portal_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_messages" ADD CONSTRAINT "portal_messages_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
