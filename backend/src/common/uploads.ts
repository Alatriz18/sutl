import { BadRequestException } from '@nestjs/common';
import { closeSync, openSync, readSync, unlinkSync } from 'fs';
import { extname, join } from 'path';

// Firmas de archivo (los primeros bytes) por extensión: el tipo se comprueba por el CONTENIDO, no solo por el nombre,
// para que un archivo renombrado (un ejecutable como «factura.pdf») no se guarde como si fuera un documento.
const CABECERAS: Record<string, number[][]> = {
  '.pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  '.png': [[0x89, 0x50, 0x4e, 0x47]],
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.xlsx': [[0x50, 0x4b, 0x03, 0x04]], // ZIP
  '.docx': [[0x50, 0x4b, 0x03, 0x04]],
  '.doc': [[0xd0, 0xcf, 0x11, 0xe0]], // OLE2
};

type ArchivoSubido = { path?: string; originalname: string };

function leerCabecera(ruta: string, bytes: number): Buffer {
  const fd = openSync(ruta, 'r');
  try {
    const b = Buffer.alloc(bytes);
    const n = readSync(fd, b, 0, bytes, 0);
    return b.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

export function contenidoCoincideConExtension(ruta: string, nombreOriginal: string): boolean {
  const firmas = CABECERAS[extname(nombreOriginal).toLowerCase()];
  if (!firmas) return false;
  try {
    const cab = leerCabecera(ruta, 8);
    return firmas.some((f) => f.every((byte, i) => cab[i] === byte));
  } catch {
    return false;
  }
}

// Borra un archivo ya guardado por la subida (cuando la operación se rechaza no debe quedar huérfano en el disco).
export function descartarArchivo(file?: { path?: string }) {
  if (!file?.path) return;
  try {
    unlinkSync(file.path.startsWith('/') || /^[a-zA-Z]:/.test(file.path) ? file.path : join(process.cwd(), file.path));
  } catch {
    // ya no estaba
  }
}

// Rechaza (y borra) un archivo cuyo contenido no corresponde a su extensión.
export function exigirContenidoValido(file: ArchivoSubido) {
  if (!file.path || !contenidoCoincideConExtension(file.path, file.originalname)) {
    descartarArchivo(file);
    throw new BadRequestException('El contenido del archivo no corresponde a su tipo');
  }
}
