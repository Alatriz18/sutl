import { EMAIL_RE, TELEFONO_RE, mensajeSeguro } from './channel';

describe('validación de destinos', () => {
  it.each(['a@b.com', 'nombre.apellido+tag@empresa.com.ec'])('acepta el correo %s', (v) => expect(EMAIL_RE.test(v)).toBe(true));
  it.each(['', 'sin-arroba', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', 'a@b.com;c@d.com', '<a@b.com>', 'a@b.com\nBcc: x@y.com'])(
    'rechaza el correo "%s"',
    (v) => expect(EMAIL_RE.test(v)).toBe(false),
  );
  it.each(['+593991234567', '+14155552671'])('acepta el teléfono %s', (v) => expect(TELEFONO_RE.test(v)).toBe(true));
  it.each(['0991234567', '593991234567', '+0991234567', '+59 399 123', '+5939912345678901', '+593abc'])('rechaza el teléfono "%s"', (v) =>
    expect(TELEFONO_RE.test(v)).toBe(false),
  );
});

describe('mensajeSeguro', () => {
  it('quita tokens y contraseñas del texto', () => {
    expect(mensajeSeguro(new Error('fallo con token=abc123 y password: hunter2'))).not.toMatch(/abc123|hunter2/);
    expect(mensajeSeguro(new Error('Authorization: Bearer eyJhbGciOi.secreto'))).not.toContain('eyJhbGciOi');
  });
  it('acorta y compacta espacios', () => {
    const r = mensajeSeguro(new Error('x'.repeat(1000)));
    expect(r.length).toBe(300);
    expect(mensajeSeguro(new Error('a\n\n  b'))).toBe('a b');
  });
  it('acepta valores que no son Error', () => {
    expect(mensajeSeguro('texto')).toBe('texto');
  });
});
