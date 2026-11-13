import {
  base32Codificar,
  base32Decodificar,
  codigoParaPaso,
  generarCodigosRecuperacion,
  generarSecreto,
  hashCodigoRecuperacion,
  paso,
  urlOtpauth,
  verificarCodigo,
} from './totp';

// Vectores de la RFC 6238 (apéndice B), SHA-1, secreto ASCII "12345678901234567890":
// los códigos de 8 dígitos publicados terminan en los 6 que usa este módulo.
const SECRETO_RFC = base32Codificar(Buffer.from('12345678901234567890'));
const VECTORES: [number, string][] = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
  [20000000000, '353130'],
];

describe('TOTP (RFC 6238)', () => {
  it.each(VECTORES)('coincide con el vector oficial en t=%i', (t, esperado) => {
    expect(codigoParaPaso(SECRETO_RFC, paso(t * 1000))).toBe(esperado);
  });

  it('base32 ida y vuelta', () => {
    const buf = Buffer.from('hola mundo SUTL');
    expect(base32Decodificar(base32Codificar(buf)).equals(buf)).toBe(true);
    expect(base32Decodificar('jbsw y3dp').toString()).toBe('Hello');
  });

  it('un secreto base32 inválido lanza error', () => {
    expect(() => base32Decodificar('!!!')).toThrow();
  });

  it('genera secretos distintos de 32 caracteres base32', () => {
    const a = generarSecreto();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(generarSecreto()).not.toBe(a);
  });

  describe('verificar', () => {
    const ahora = 1111111109 * 1000;
    it('acepta el código vigente y devuelve su paso', () => {
      expect(verificarCodigo(SECRETO_RFC, '081804', ahora)).toBe(paso(ahora));
    });
    it('tolera un paso de desfase hacia cada lado, pero no dos', () => {
      const p = paso(ahora);
      expect(verificarCodigo(SECRETO_RFC, codigoParaPaso(SECRETO_RFC, p - 1), ahora)).toBe(p - 1);
      expect(verificarCodigo(SECRETO_RFC, codigoParaPaso(SECRETO_RFC, p + 1), ahora)).toBe(p + 1);
      expect(verificarCodigo(SECRETO_RFC, codigoParaPaso(SECRETO_RFC, p - 2), ahora)).toBeNull();
      expect(verificarCodigo(SECRETO_RFC, codigoParaPaso(SECRETO_RFC, p + 2), ahora)).toBeNull();
    });
    it('rechaza códigos mal formados o equivocados', () => {
      for (const malo of ['', '12345', '1234567', 'abcdef', '000000', ' 081804']) {
        expect(verificarCodigo(SECRETO_RFC, malo, ahora)).toBeNull();
      }
    });
  });

  it('la URL para la app incluye el secreto y la cuenta codificada', () => {
    const url = urlOtpauth('ABC234', 'ana@empresa.com');
    expect(url).toBe('otpauth://totp/SUTL%3Aana%40empresa.com?secret=ABC234&issuer=SUTL&algorithm=SHA1&digits=6&period=30');
  });

  describe('códigos de recuperación', () => {
    it('genera 10 códigos únicos con formato XXXX-XXXX sin caracteres ambiguos', () => {
      const codigos = generarCodigosRecuperacion();
      expect(codigos).toHaveLength(10);
      expect(new Set(codigos).size).toBe(10);
      for (const c of codigos) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    });
    it('el hash ignora guiones, espacios y mayúsculas', () => {
      expect(hashCodigoRecuperacion('abcd-efgh')).toBe(hashCodigoRecuperacion(' ABCD EFGH '));
      expect(hashCodigoRecuperacion('ABCD-EFGH')).not.toBe(hashCodigoRecuperacion('ABCD-EFGJ'));
    });
  });
});
