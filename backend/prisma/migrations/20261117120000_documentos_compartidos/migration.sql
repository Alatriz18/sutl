-- Documentos compartidos con el cliente final y el proveedor (C3b). Por defecto, internos.
ALTER TABLE "documents" ADD COLUMN "visibleCliente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "visibleProveedor" BOOLEAN NOT NULL DEFAULT false;
