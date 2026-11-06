import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';

function aplanar(errores: ValidationError[], prefijo = ''): string[] {
  const mensajes: string[] = [];
  for (const e of errores) {
    const campo = prefijo ? `${prefijo}.${e.property}` : e.property;
    mensajes.push(...Object.values(e.constraints ?? {}));
    if (e.children?.length) mensajes.push(...aplanar(e.children, campo));
  }
  return mensajes;
}

// Valida una fila suelta (de una importación) contra un DTO con las mismas
// reglas que la API normal, pero devolviendo los errores de esa fila en vez de
// rechazar todo el lote: así una importación de 500 filas informa cuáles
// fallaron y por qué. Los campos desconocidos se rechazan (suelen ser un typo
// en el mapeo de columnas).
export function validarFila<T extends object>(
  cls: new () => T,
  plano: unknown,
): { valor?: T; errores: string[] } {
  if (typeof plano !== 'object' || plano === null || Array.isArray(plano)) {
    return { errores: ['La fila no es un objeto válido'] };
  }
  const instancia = plainToInstance(cls, plano);
  const errores = validateSync(instancia, { whitelist: true, forbidNonWhitelisted: true });
  return errores.length > 0 ? { errores: aplanar(errores) } : { valor: instancia, errores: [] };
}
