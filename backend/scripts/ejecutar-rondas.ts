// Ejecuta AHORA las rondas que en producción corren solas (cada pocas horas), para mostrarlas en una presentación:
// riesgo de abastecimiento, excepciones con plazo y avisos por correo de documentos por vencer o vencidos.
//
//   npm run demo:rondas
//
// Los correos quedan en Mailpit (http://localhost:8025).
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentExpiryMonitorService } from '../src/modules/documents/document-expiry-monitor.service';
import { ExceptionsService } from '../src/modules/exceptions/exceptions.service';
import { RiskMonitorService } from '../src/modules/supply-risk/risk-monitor.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const riesgo = await app.get(RiskMonitorService).evaluarTodas();
    console.log('Riesgo de abastecimiento :', riesgo);
    const excepciones = await app.get(ExceptionsService).evaluarTodas();
    console.log('Excepciones              :', excepciones);
    const documentos = await app.get(DocumentExpiryMonitorService).avisarTodas();
    console.log('Avisos de vencimientos   :', documentos);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
