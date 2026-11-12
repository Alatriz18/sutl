import { randomBytes } from 'crypto';
import { cifrar, descifrar, sha256 } from './crypto';
import { ipPrivada, validarUrlDestino } from './url-destino';

describe('cifrado AES-256-GCM', () => {
  const original = process.env.ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
  });
  afterAll(() => {
    if (original === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original;
  });

  it('descifra lo que cifró', () => {
    expect(descifrar(cifrar('whsec_secreto'))).toBe('whsec_secreto');
  });

  it('el mismo texto cifrado dos veces da resultados distintos (IV aleatorio)', () => {
    expect(cifrar('x')).not.toBe(cifrar('x'));
  });

  it('el valor cifrado no contiene el texto original', () => {
    expect(cifrar('whsec_secreto')).not.toContain('whsec_secreto');
  });

  it('detecta manipulación del texto cifrado', () => {
    const [v, iv, tag, ct] = cifrar('hola').split(':');
    const alterado = Buffer.from(ct, 'base64');
    alterado[0] ^= 1;
    expect(() => descifrar([v, iv, tag, alterado.toString('base64')].join(':'))).toThrow();
  });

  it('no descifra con otra clave', () => {
    const c = cifrar('hola');
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    expect(() => descifrar(c)).toThrow();
  });

  it('sin clave o con una clave de tamaño incorrecto falla con un mensaje claro', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => cifrar('x')).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = Buffer.from('corta').toString('base64');
    expect(() => cifrar('x')).toThrow(/32 bytes/);
  });

  it('rechaza un formato desconocido', () => {
    expect(() => descifrar('v9:a:b:c')).toThrow(/formato/);
    expect(() => descifrar('texto-plano')).toThrow();
  });

  it('sha256 es determinista', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('ipPrivada', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0',
    '100.64.0.1', '224.0.0.1', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:10.0.0.1', '::ffff:7f00:1', 'ff02::1',
    'no-es-ip',
  ])('%s es interna o inválida', (ip) => expect(ipPrivada(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '203.0.113.5', '2606:4700:4700::1111'])(
    '%s es pública',
    (ip) => expect(ipPrivada(ip)).toBe(false),
  );
});

describe('validarUrlDestino', () => {
  it.each([
    ['http://ejemplo.com/hook', 'https'],
    ['ftp://ejemplo.com', 'https'],
    ['no es url', 'válida'],
    ['https://user:pass@ejemplo.com/', 'usuario'],
    ['https://localhost/hook', 'interna'],
    ['https://servicio.internal/hook', 'interna'],
    ['https://127.0.0.1/hook', 'interna'],
    ['https://169.254.169.254/latest/meta-data', 'interna'],
    ['https://[::1]/hook', 'interna'],
    ['https://10.0.0.5:8443/hook', 'interna'],
  ])('rechaza %s', async (url, motivo) => {
    await expect(validarUrlDestino(url, false)).rejects.toThrow(new RegExp(motivo));
  });

  it('acepta una IP pública con https', async () => {
    await expect(validarUrlDestino('https://8.8.8.8/hook', false)).resolves.toBeInstanceOf(URL);
  });

  it('en desarrollo (permitirPrivadas) acepta http y direcciones locales, pero sigue prohibiendo credenciales y otros protocolos', async () => {
    await expect(validarUrlDestino('http://127.0.0.1:4000/hook', true)).resolves.toBeInstanceOf(URL);
    await expect(validarUrlDestino('http://u:p@127.0.0.1/', true)).rejects.toThrow(/usuario/);
    await expect(validarUrlDestino('file:///etc/passwd', true)).rejects.toThrow(/https/);
  });
});
