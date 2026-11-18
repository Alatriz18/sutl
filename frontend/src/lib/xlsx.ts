// Generador mínimo de archivos Excel (.xlsx) sin dependencias: un .xlsx es un ZIP de XML.
// Se escribe con ZIP «sin compresión» (válido y que Excel abre sin problema); los textos van como cadenas
// en línea y nunca como fórmulas, así que un valor que empiece con «=» no se ejecuta al abrir el archivo.

export type Celda = string | number | null;

export interface HojaXlsx {
  nombre: string;
  filas: Celda[][];
  // Ancho aproximado de cada columna, en caracteres.
  anchos?: number[];
  // Cuántas filas del inicio van en negrita (encabezado).
  encabezados?: number;
}

const enc = new TextEncoder();

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Quita lo que XML 1.0 no admite y escapa lo especial.
function xml(texto: string): string {
  return texto
    .replace(/[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A, B, …, Z, AA, AB…
export function letraColumna(indice: number): string {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Excel limita el nombre de una hoja a 31 caracteres y prohíbe [ ] : * ? / \
export function nombreHoja(nombre: string): string {
  const limpio = nombre.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return limpio || 'Hoja';
}

function xmlHoja(h: HojaXlsx): string {
  const cols = h.anchos?.length
    ? `<cols>${h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const filas = h.filas
    .map((fila, r) => {
      const negrita = r < (h.encabezados ?? 0) ? ' s="1"' : '';
      const celdas = fila
        .map((v, c) => {
          const ref = `${letraColumna(c)}${r + 1}`;
          if (v === null || v === '') return '';
          if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${negrita}><v>${v}</v></c>` : '';
          return `<c r="${ref}"${negrita} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${celdas}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${filas}</sheetData></worksheet>`;
}

interface Entrada {
  ruta: string;
  datos: Uint8Array;
}

// ZIP con las entradas sin comprimir (método 0).
export function crearZip(entradas: Entrada[]): Uint8Array {
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;
  for (const e of entradas) {
    const nombre = enc.encode(e.ruta);
    const crc = crc32(e.datos);
    const local = new Uint8Array(30 + nombre.length + e.datos.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // versión necesaria
    lv.setUint16(6, 0x0800, true); // nombres en UTF-8
    lv.setUint16(8, 0, true); // sin compresión
    lv.setUint16(10, 0, true); // hora
    lv.setUint16(12, 0x0021, true); // fecha: 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, e.datos.length, true);
    lv.setUint32(22, e.datos.length, true);
    lv.setUint16(26, nombre.length, true);
    lv.setUint16(28, 0, true);
    local.set(nombre, 30);
    local.set(e.datos, 30 + nombre.length);
    locales.push(local);

    const central = new Uint8Array(46 + nombre.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x0021, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, e.datos.length, true);
    cv.setUint32(24, e.datos.length, true);
    cv.setUint16(28, nombre.length, true);
    cv.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);
    centrales.push(central);
    desplazamiento += local.length;
  }
  const tamCentral = centrales.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, entradas.length, true);
  fv.setUint16(10, entradas.length, true);
  fv.setUint32(12, tamCentral, true);
  fv.setUint32(16, desplazamiento, true);

  const todo = new Uint8Array(desplazamiento + tamCentral + fin.length);
  let pos = 0;
  for (const parte of [...locales, ...centrales, fin]) {
    todo.set(parte, pos);
    pos += parte.length;
  }
  return todo;
}

export function crearXlsx(hojas: HojaXlsx[]): Uint8Array {
  if (hojas.length === 0) throw new Error('Un libro de Excel necesita al menos una hoja');
  // Excel no admite dos hojas con el mismo nombre (sin distinguir mayúsculas).
  const usados = new Set<string>();
  const nombres = hojas.map((h) => {
    let n = nombreHoja(h.nombre);
    for (let i = 2; usados.has(n.toLowerCase()); i++) n = `${nombreHoja(h.nombre).slice(0, 28)} ${i}`;
    usados.add(n.toLowerCase());
    return n;
  });
  const t = (s: string) => enc.encode(s);
  const entradas: Entrada[] = [
    {
      ruta: '[Content_Types].xml',
      datos: t(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join('')}</Types>`,
      ),
    },
    {
      ruta: '_rels/.rels',
      datos: t(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      ),
    },
    {
      ruta: 'xl/workbook.xml',
      datos: t(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres
          .map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('')}</sheets></workbook>`,
      ),
    },
    {
      ruta: 'xl/_rels/workbook.xml.rels',
      datos: t(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
          .join('')}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    {
      ruta: 'xl/styles.xml',
      datos: t(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
      ),
    },
    ...hojas.map((h, i) => ({ ruta: `xl/worksheets/sheet${i + 1}.xml`, datos: t(xmlHoja(h)) })),
  ];
  return crearZip(entradas);
}

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function descargarXlsx(nombreArchivo: string, hojas: HojaXlsx[]) {
  const bytes = crearXlsx(hojas);
  const blob = new Blob([bytes as BlobPart], { type: MIME_XLSX });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
