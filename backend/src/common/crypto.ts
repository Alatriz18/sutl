import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Cifrado en reposo (AES-256-GCM) para secretos que hay que poder recuperar,
// como el secreto con el que se firman los webhooks. La clave sale de
// ENCRYPTION_KEY: 32 bytes en base64 (`openssl rand -base64 32`). Nunca va en
// el código ni en el repositorio.

function clave(): Buffer {
  const crudo = process.env.ENCRYPTION_KEY;
  if (!crudo) throw new Error('Falta ENCRYPTION_KEY: no se pueden cifrar ni descifrar secretos.');
  const buf = Buffer.from(crudo, 'base64');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY debe ser de 32 bytes en base64 (openssl rand -base64 32).');
  return buf;
}

export function claveDeCifradoConfigurada(): boolean {
  try {
    clave();
    return true;
  } catch {
    return false;
  }
}

// Formato: v1:<iv>:<etiqueta de autenticación>:<texto cifrado>, todo en base64.
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', clave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), cifrado.toString('base64')].join(':');
}

export function descifrar(valor: string): string {
  const [version, iv, tag, cifrado] = valor.split(':');
  if (version !== 'v1' || !iv || !tag || !cifrado) throw new Error('Valor cifrado con formato desconocido.');
  const decipher = createDecipheriv('aes-256-gcm', clave(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64')), decipher.final()]).toString('utf8');
}

export const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');
