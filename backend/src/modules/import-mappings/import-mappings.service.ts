import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Campos de SUTL a los que se puede mapear una columna del archivo, por tipo
// de importación. La clave del mapeo es el campo de SUTL; el valor, el nombre
// de la columna del archivo del cliente.
export const CAMPOS_IMPORTACION = {
  ordenes_compra: [
    'numero',
    'proveedor',
    'proveedorTaxId',
    'incoterm',
    'moneda',
    'fechaEmision',
    'fechaRequerida',
    'fechaConfirmadaProveedor',
    'notas',
    'sku',
    'descripcion',
    'cantidad',
    'unidad',
    'precioUnitario',
  ],
  politicas_inventario: ['sku', 'consumoDiario', 'stockSeguridad', 'leadTimeDias', 'existenciasExternas'],
} as const;

export type TipoImportacion = keyof typeof CAMPOS_IMPORTACION;
export const TIPOS_IMPORTACION = Object.keys(CAMPOS_IMPORTACION) as TipoImportacion[];

@Injectable()
export class ImportMappingsService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(tenantId: string, tipo: string) {
    const t = this.assertTipo(tipo);
    const fila = await this.prisma.importMapping.findUnique({
      where: { tenantId_tipo: { tenantId, tipo: t } },
      select: { mapeo: true, updatedAt: true },
    });
    return { tipo: t, mapeo: fila ? this.limpiar(t, fila.mapeo) : null, updatedAt: fila?.updatedAt ?? null };
  }

  async guardar(tenantId: string, tipo: string, mapeo: Record<string, unknown>) {
    const t = this.assertTipo(tipo);
    const limpio = this.limpiar(t, mapeo);
    await this.prisma.importMapping.upsert({
      where: { tenantId_tipo: { tenantId, tipo: t } },
      create: { tenantId, tipo: t, mapeo: limpio as Prisma.InputJsonValue },
      update: { mapeo: limpio as Prisma.InputJsonValue },
    });
    return { tipo: t, mapeo: limpio };
  }

  private assertTipo(tipo: string): TipoImportacion {
    if (!TIPOS_IMPORTACION.includes(tipo as TipoImportacion)) {
      throw new BadRequestException(`Tipo de importación desconocido; usa: ${TIPOS_IMPORTACION.join(', ')}`);
    }
    return tipo as TipoImportacion;
  }

  // Defensivo: se guardan solo campos conocidos con nombres de columna de
  // texto razonables; el JSON de la base nunca se devuelve tal cual.
  private limpiar(tipo: TipoImportacion, crudo: unknown): Record<string, string> {
    const salida: Record<string, string> = {};
    if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return salida;
    for (const campo of CAMPOS_IMPORTACION[tipo]) {
      const valor = (crudo as Record<string, unknown>)[campo];
      if (typeof valor === 'string' && valor.trim() !== '' && valor.length <= 120) salida[campo] = valor.trim();
    }
    return salida;
  }
}
