// Un canal de envío (correo, WhatsApp…). Se inyecta por token para poder
// sustituirlo por uno falso en las pruebas sin tocar el servicio.
export interface MensajeSaliente {
  destino: string;
  asunto: string;
  mensaje: string;
}

export interface CanalEnvio {
  // false si faltan credenciales/configuración del proveedor.
  readonly disponible: boolean;
  enviar(m: MensajeSaliente): Promise<void>;
}

export const CANAL_EMAIL = Symbol('CANAL_EMAIL');
export const CANAL_WHATSAPP = Symbol('CANAL_WHATSAPP');

// Error cuyo reintento no tiene sentido (destino inválido, rechazo definitivo).
export class ErrorDefinitivo extends Error {}

// Los mensajes de error se guardan en la base y se muestran al usuario:
// se acortan y se les quita cualquier cosa que parezca un secreto.
export function mensajeSeguro(e: unknown): string {
  const crudo = e instanceof Error ? e.message : String(e);
  return crudo
    .replace(/(bearer|token|password|pass|secret|key)[=:\s]+\S+/gi, '$1=***')
    .replace(/\s+/g, ' ')
    .slice(0, 300);
}

export const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
// E.164: + y 8 a 15 dígitos.
export const TELEFONO_RE = /^\+[1-9]\d{7,14}$/;
