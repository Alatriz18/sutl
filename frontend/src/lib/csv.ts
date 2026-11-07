// Lectura de archivos CSV para las importaciones (Excel → «Guardar como CSV»).
// Sin dependencias y sin sintaxis que no sea borrable por TypeScript, para
// poder probarlo directo con Node (src/lib/csv.test.mjs).

export interface CsvParseado {
  delimitador: string;
  encabezados: string[];
  filas: string[][];
  // Número de línea del archivo (1 = encabezados) de cada fila de datos, para
  // poder decirle al usuario exactamente dónde está un error.
  lineas: number[];
}

const DELIMITADORES = [';', ',', '\t', '|'];

// Cuenta cada delimitador en la primera línea, fuera de comillas. Excel con
// configuración regional en español exporta con «;», en inglés con «,».
function detectarDelimitador(texto: string): string {
  const cuentas = new Map(DELIMITADORES.map((d) => [d, 0]));
  let enComillas = false;
  for (const c of texto) {
    if (c === '"') enComillas = !enComillas;
    else if (!enComillas && (c === '\n' || c === '\r')) break;
    else if (!enComillas && cuentas.has(c)) cuentas.set(c, (cuentas.get(c) ?? 0) + 1);
  }
  let mejor = ',';
  let max = 0;
  for (const [d, n] of cuentas) {
    if (n > max) {
      mejor = d;
      max = n;
    }
  }
  return mejor;
}

export function parseCsv(entrada: string): CsvParseado {
  const texto = entrada.replace(/^﻿/, '');
  const delimitador = detectarDelimitador(texto);
  const registros: { celdas: string[]; linea: number }[] = [];

  let celdas: string[] = [];
  let actual = '';
  let enComillas = false;
  let linea = 1;
  let lineaInicio = 1;

  const cerrarCelda = () => {
    celdas.push(actual.trim());
    actual = '';
  };
  const cerrarRegistro = () => {
    cerrarCelda();
    if (celdas.some((c) => c !== '')) registros.push({ celdas, linea: lineaInicio });
    celdas = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        if (c === '\n') linea++;
        actual += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === delimitador) {
      cerrarCelda();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      cerrarRegistro();
      linea++;
      lineaInicio = linea;
    } else {
      actual += c;
    }
  }
  if (actual !== '' || celdas.length > 0) cerrarRegistro();

  return construirTabla(delimitador, registros);
}

// Arma la tabla (encabezados únicos + filas del mismo ancho) desde registros
// ya separados en celdas. Lo comparten el CSV y el Excel (.xlsx).
function construirTabla(delimitador: string, registros: { celdas: string[]; linea: number }[]): CsvParseado {
  if (registros.length === 0) {
    return { delimitador, encabezados: [], filas: [], lineas: [] };
  }

  // Encabezados sin vacíos ni repetidos (si no, el mapeo sería ambiguo).
  const vistos = new Map<string, number>();
  const encabezados = registros[0].celdas.map((h, i) => {
    const base = h || `Columna ${i + 1}`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });

  const datos = registros.slice(1);
  return {
    delimitador,
    encabezados,
    // Cada fila se normaliza al ancho de los encabezados.
    filas: datos.map((r) => encabezados.map((_, i) => r.celdas[i] ?? '')),
    lineas: datos.map((r) => r.linea),
  };
}

// Una celda de Excel (.xlsx) llega tipada: número, fecha, booleano o texto.
// Se pasa a texto para reutilizar la misma validación que el CSV, cuidando que
// un número real nunca se reinterprete: 1.234 (un mil doscientos treinta y
// cuatro milésimas) no debe leerse como «1.234» = 1234 por el criterio de miles.
export function celdaATexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return '';
    return `${valor.getUTCFullYear()}-${pad(valor.getUTCMonth() + 1)}-${pad(valor.getUTCDate())}`;
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return '';
    let t = String(valor);
    if (/e/i.test(t)) t = valor.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
    const m = /^-?\d{1,3}\.\d{3}$/.exec(t);
    // Un cero final no cambia el valor y evita la ambigüedad con el separador de miles.
    return m ? t + '0' : t;
  }
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor).trim();
}

// Tabla desde la matriz de una hoja de Excel (fila 1 = encabezados). Las filas
// totalmente vacías se descartan, pero la línea que se reporta es la real de la hoja.
export function tablaDesdeHoja(matriz: unknown[][]): CsvParseado {
  const registros = matriz
    .map((fila, i) => ({ celdas: fila.map(celdaATexto), linea: i + 1 }))
    .filter((r, i) => i === 0 || r.celdas.some((c) => c !== ''));
  return construirTabla('xlsx', registros);
}

// «1.234,56», «1,234.56», «$ 12,50», «1234,5»… → número. null si no es un número.
// Un punto o coma con exactamente tres dígitos detrás se toma como separador de
// miles (es lo habitual en los Excel de la región: «1.234» = 1234).
export function normalizarNumero(valor: string): number | null {
  let s = valor.replace(/[^\d.,+-]/g, '');
  if (!/\d/.test(s)) return null;
  const negativo = s.startsWith('-');
  s = s.replace(/[+-]/g, '');

  const puntos = (s.match(/\./g) ?? []).length;
  const comas = (s.match(/,/g) ?? []).length;
  if (puntos > 0 && comas > 0) {
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    s = s.split(miles).join('').replace(decimal, '.');
  } else if (puntos > 1 || comas > 1) {
    s = s.replace(/[.,]/g, '');
  } else if (puntos === 1 || comas === 1) {
    const sep = puntos === 1 ? '.' : ',';
    const [entera, decimales] = s.split(sep);
    s = decimales.length === 3 && entera.length >= 1 && entera.length <= 3 && entera !== '0' ? entera + decimales : entera + '.' + decimales;
  }
  const n = Number(s);
  return Number.isFinite(n) ? (negativo ? -n : n) : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fechaValida = (a: number, m: number, d: number) => {
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
};

// «2026-12-15», «15/12/2026», «15-12-26», «15.12.2026» o un número de serie de
// Excel (46000) → «YYYY-MM-DD». null si no es una fecha real (ej. 31/02/2026).
export function normalizarFecha(valor: string): string | null {
  const s = valor.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) {
    const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return fechaValida(a, mes, d) ? `${a}-${pad(mes)}-${pad(d)}` : null;
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const d = Number(m[1]);
    const mes = Number(m[2]);
    const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return fechaValida(a, mes, d) ? `${a}-${pad(mes)}-${pad(d)}` : null;
  }
  if (/^\d{5}$/.test(s)) {
    const serie = Number(s);
    if (serie < 20000 || serie > 80000) return null;
    const f = new Date(Date.UTC(1899, 11, 30) + serie * 86400000);
    return `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`;
  }
  return null;
}
