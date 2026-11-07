// Límites de peticiones configurables por entorno, para poder correr suites
// e2e de navegador (que hacen muchos logins seguidos) sin debilitar producción.
// Reglas de seguridad:
//  - Un valor ausente o inválido (no entero positivo) usa el valor por defecto.
//  - En producción nunca se permite subir el límite por encima del defecto:
//    la variable solo sirve para endurecerlo.
export function limiteDesdeEntorno(variable: string, porDefecto: number): number {
  const crudo = process.env[variable];
  const n = crudo !== undefined && /^\d+$/.test(crudo) ? parseInt(crudo, 10) : NaN;
  if (!Number.isInteger(n) || n < 1) return porDefecto;
  return process.env.NODE_ENV === 'production' ? Math.min(n, porDefecto) : n;
}

export const LIMITE_LOGIN_POR_DEFECTO = 5;
export const LIMITE_GLOBAL_POR_DEFECTO = 120;

// Se evalúa en cada petición (función), porque el .env se carga después de
// que Nest lee los decoradores.
export const limiteLogin = () => limiteDesdeEntorno('LOGIN_RATE_LIMIT', LIMITE_LOGIN_POR_DEFECTO);
export const limiteGlobal = () => limiteDesdeEntorno('RATE_LIMIT', LIMITE_GLOBAL_POR_DEFECTO);
