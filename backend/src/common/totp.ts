import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Contraseña de un solo uso basada en tiempo (TOTP, RFC 6238) con HMAC-SHA1,
// 6 dígitos y paso de 30 s: compatible con Google Authenticator, Microsoft
// Authenticator, Authy y 1Password. Sin dependencias externas.

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PASO_SEGUNDOS = 30;
const DIGITOS = 6;

export function base32Codificar(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function base32Decodificar(texto: string): Buffer {
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of texto.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')) {
    const i = ALFABETO.indexOf(c);
    if (i === -1) throw new Error('Secreto base32 inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// 160 bits aleatorios, el tamaño recomendado por la RFC para HMAC-SHA1.
export function generarSecreto(): string {
  return base32Codificar(randomBytes(20));
}

export function paso(ahora: number = Date.now()): number {
  return Math.floor(ahora / 1000 / PASO_SEGUNDOS);
}

// Código de 6 dígitos para un paso de tiempo.
export function codigoParaPaso(secreto: string, pasoTiempo: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(pasoTiempo));
  const hmac = createHmac('sha1', base32Decodificar(secreto)).update(contador).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binario = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binario % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Devuelve el paso de tiempo que coincide (para recordarlo y no aceptar el
// mismo código dos veces) o null. Tolera ±1 paso por desfase de relojes.
export function verificarCodigo(secreto: string, codigo: string, ahora: number = Date.now(), ventana = 1): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const actual = paso(ahora);
  let encontrado: number | null = null;
  // Se recorren todos los pasos sin cortar: el tiempo no revela cuál acertó.
  for (let d = -ventana; d <= ventana; d++) {
    if (iguales(codigoParaPaso(secreto, actual + d), codigo) && encontrado === null) encontrado = actual + d;
  }
  return encontrado;
}

// URL que leen las apps de autenticación (también se dibuja como QR).
export function urlOtpauth(secreto: string, cuenta: string, emisor = 'SUTL'): string {
  const etiqueta = encodeURIComponent(`${emisor}:${cuenta}`);
  return `otpauth://totp/${etiqueta}?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASO_SEGUNDOS}`;
}

// Códigos de recuperación de un solo uso (por si se pierde el teléfono).
export function generarCodigosRecuperacion(cantidad = 10): string[] {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I
  return Array.from({ length: cantidad }, () => {
    const b = randomBytes(8);
    const c = Array.from(b, (x) => alfabeto[x % alfabeto.length]).join('');
    return `${c.slice(0, 4)}-${c.slice(4)}`;
  });
}

export function normalizarCodigoRecuperacion(c: string): string {
  return c.replace(/[\s-]/g, '').toUpperCase();
}

export function hashCodigoRecuperacion(c: string): string {
  return createHash('sha256').update(normalizarCodigoRecuperacion(c)).digest('hex');
}
