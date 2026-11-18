-- Avisos por correo de documentos por vencer / vencidos (C1b): cada documento se avisa una sola vez por estado.
ALTER TABLE "documents" ADD COLUMN "avisoPorVencerAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "avisoVencidoAt" TIMESTAMP(3);
