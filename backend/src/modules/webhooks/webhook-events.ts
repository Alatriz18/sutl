import { createHmac, timingSafeEqual } from 'crypto';

// Eventos que SUTL publica. Son parte del contrato con quien integra: no se
// renombran, solo se agregan nuevos.
export const EVENTOS_WEBHOOK = [
  'envio.creado',
  'envio.estado_cambiado',
  'orden_compra.estado_cambiado',
  'riesgo.semaforo_cambiado',
] as const;
export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number];

// Evento interno del botón "Probar": no hace falta suscribirse a él.
export const EVENTO_PRUEBA = 'webhook.prueba';

// Firma de cada entrega: HMAC-SHA256 de `${t}.${cuerpo}` con el secreto del
// webhook. Incluir la marca de tiempo permite rechazar entregas repetidas
// (replay) antiguas del lado de quien recibe.
export function firmarEntrega(secreto: string, timestamp: number, cuerpo: string): string {
  const v1 = createHmac('sha256', secreto).update(`${timestamp}.${cuerpo}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

// Lo que debería hacer quien recibe el webhook; se usa también en las pruebas.
export function verificarFirma(secreto: string, cabecera: string, cuerpo: string, toleranciaSeg = 300, ahora = Date.now()): boolean {
  const partes = Object.fromEntries(cabecera.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(partes.t);
  if (!Number.isFinite(t) || !partes.v1) return false;
  if (Math.abs(ahora / 1000 - t) > toleranciaSeg) return false;
  const esperado = createHmac('sha256', secreto).update(`${t}.${cuerpo}`).digest();
  const recibido = Buffer.from(partes.v1, 'hex');
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
