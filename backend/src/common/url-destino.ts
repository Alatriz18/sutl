import { promises as dns } from 'dns';
import { isIP } from 'net';

// Protección contra SSRF para las URLs que la empresa registra y a las que el
// SERVIDOR hace peticiones (webhooks): sin esto, alguien podría apuntar un
// webhook a la red interna (base de datos, metadatos de la nube…) y leer la
// respuesta en el historial de entregas.

export class UrlDestinoInvalida extends Error {}

// IPv4 privadas, de loopback, enlace local (incluye los metadatos de la nube
// 169.254.169.254), CGNAT, multicast y reservadas.
function ipv4Privada(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function ipPrivada(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return ipv4Privada(ip);
  if (version === 6) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    // IPv4 mapeada (::ffff:10.0.0.1) o en notación hexadecimal (::ffff:a00:1).
    const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapeada) return ipv4Privada(mapeada[1]);
    if (l.startsWith('::ffff:')) return true;
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff');
  }
  return true; // lo que no se reconoce como IP no se acepta
}

// Valida la URL y, salvo que `permitirPrivadas` (solo desarrollo y pruebas),
// resuelve el nombre y rechaza cualquier dirección interna. Se vuelve a llamar
// en cada entrega: el DNS puede cambiar después del registro.
export async function validarUrlDestino(crudo: string, permitirPrivadas: boolean): Promise<URL> {
  let url: URL;
  try {
    url = new URL(crudo);
  } catch {
    throw new UrlDestinoInvalida('La URL no es válida.');
  }
  if (url.protocol !== 'https:' && !(permitirPrivadas && url.protocol === 'http:')) {
    throw new UrlDestinoInvalida('La URL debe usar https.');
  }
  if (url.username || url.password) throw new UrlDestinoInvalida('La URL no puede incluir usuario ni contraseña.');
  if (permitirPrivadas) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UrlDestinoInvalida('La URL apunta a una dirección interna.');
  }
  const direcciones = isIP(host) ? [host] : await dns.lookup(host, { all: true }).then((r) => r.map((x) => x.address)).catch(() => []);
  if (direcciones.length === 0) throw new UrlDestinoInvalida('No se pudo resolver el dominio de la URL.');
  if (direcciones.some(ipPrivada)) throw new UrlDestinoInvalida('La URL apunta a una dirección interna.');
  return url;
}
