import { limiteDesdeEntorno } from './rate-limit';

describe('limiteDesdeEntorno', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('sin variable usa el valor por defecto', () => {
    delete process.env.X_LIMIT;
    expect(limiteDesdeEntorno('X_LIMIT', 5)).toBe(5);
  });

  it.each(['abc', '0', '-3', '2.5', '', ' 7', '1e3'])('valor inválido "%s" usa el defecto', (v) => {
    process.env.X_LIMIT = v;
    expect(limiteDesdeEntorno('X_LIMIT', 5)).toBe(5);
  });

  it('fuera de producción permite subir el límite', () => {
    process.env.NODE_ENV = 'development';
    process.env.X_LIMIT = '500';
    expect(limiteDesdeEntorno('X_LIMIT', 5)).toBe(500);
  });

  it('en producción no permite subirlo, pero sí endurecerlo', () => {
    process.env.NODE_ENV = 'production';
    process.env.X_LIMIT = '500';
    expect(limiteDesdeEntorno('X_LIMIT', 5)).toBe(5);
    process.env.X_LIMIT = '2';
    expect(limiteDesdeEntorno('X_LIMIT', 5)).toBe(2);
  });
});
