-- Evidencia adjunta a las tareas (B3c).
CREATE TABLE "task_attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "urlArchivo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_attachments_taskId_createdAt_idx" ON "task_attachments"("taskId", "createdAt");
CREATE INDEX "task_attachments_tenantId_idx" ON "task_attachments"("tenantId");

ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
