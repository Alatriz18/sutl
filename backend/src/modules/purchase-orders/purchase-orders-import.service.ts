import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validarFila } from '../../common/validate-row';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportPurchaseOrderRowDto, ImportPurchaseOrdersDto } from './dto/import-purchase-orders.dto';

const MAX_LINEAS_POR_OC = 500;
const CAMPOS_CABECERA = [
  'proveedor',
  'proveedorTaxId',
  'incoterm',
  'moneda',
  'fechaEmision',
  'fechaRequerida',
  'fechaConfirmadaProveedor',
  'notas',
] as const;

export type FilaValida = { fila: number; dto: ImportPurchaseOrderRowDto };
export type EstadoOrden = 'nueva' | 'omitida' | 'error';
export interface ResultadoOrden {
  numero: string;
  estado: EstadoOrden;
  lineas: number;
  proveedor: string | null;
  mensajes: string[];
}

const norm = (s: string | undefined | null) => (s ?? '').trim().toLowerCase();

// Importación de OCs desde un archivo (Excel/CSV que la web ya leyó y mapeó).
// Todo se valida acá, nunca en la web: la API es la que garantiza las reglas.
// Repetible: las OCs que ya existen se omiten, así volver a cargar el mismo
// archivo no duplica nada.
@Injectable()
export class PurchaseOrdersImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importar(tenantId: string, userId: string, dto: ImportPurchaseOrdersDto) {
    const errores: { fila: number; numero: string | null; mensajes: string[] }[] = [];
    const grupos = new Map<string, FilaValida[]>();
    const numerosConError = new Set<string>();

    // 1) Validar cada fila y agrupar por N° de OC.
    dto.filas.forEach((plana, i) => {
      const fila = i + 1;
      const { valor, errores: mensajes } = validarFila(ImportPurchaseOrderRowDto, plana);
      const numeroCrudo = typeof (plana as { numero?: unknown }).numero === 'string' ? (plana as { numero: string }).numero.trim() : null;
      if (!valor) {
        errores.push({ fila, numero: numeroCrudo || null, mensajes });
        if (numeroCrudo) numerosConError.add(numeroCrudo);
        return;
      }
      const numero = valor.numero.trim();
      if (!numero) {
        errores.push({ fila, numero: null, mensajes: ['El N° de OC no puede estar vacío'] });
        return;
      }
      valor.numero = numero;
      const lista = grupos.get(numero) ?? [];
      lista.push({ fila, dto: valor });
      grupos.set(numero, lista);
    });

    // 2) Proveedores y OCs existentes del propio tenant.
    const numeros = [...new Set([...grupos.keys(), ...numerosConError])];
    const [proveedores, existentes] = await Promise.all([
      this.prisma.partner.findMany({
        where: { tenantId, tipo: 'proveedor', activo: true },
        select: { id: true, nombre: true, taxId: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: { tenantId, numero: { in: numeros } },
        select: { numero: true, estado: true },
      }),
    ]);
    const porTaxId = new Map<string, { id: string; nombre: string }[]>();
    const porNombre = new Map<string, { id: string; nombre: string }[]>();
    for (const p of proveedores) {
      if (p.taxId) porTaxId.set(norm(p.taxId), [...(porTaxId.get(norm(p.taxId)) ?? []), p]);
      porNombre.set(norm(p.nombre), [...(porNombre.get(norm(p.nombre)) ?? []), p]);
    }
    const estadoExistente = new Map(existentes.map((e) => [e.numero, e.estado]));

    const resultados: ResultadoOrden[] = [];
    const aCrear: { numero: string; proveedorId: string | null; proveedorNuevo: string | null; taxIdNuevo: string | null; filas: FilaValida[] }[] = [];
    const proveedoresNuevos = new Map<string, { nombre: string; taxId: string | null }>();

    // OCs con filas inválidas: no se importan a medias.
    for (const numero of numerosConError) {
      if (!grupos.has(numero)) {
        resultados.push({ numero, estado: 'error', lineas: 0, proveedor: null, mensajes: ['Tiene filas con errores; la OC no se importa a medias'] });
      }
    }

    // 3) Validar cada OC como unidad.
    for (const [numero, filas] of grupos) {
      const mensajes: string[] = [];

      if (numerosConError.has(numero)) {
        mensajes.push('Otra fila de esta OC tiene errores; la OC no se importa a medias');
      }
      if (filas.length > MAX_LINEAS_POR_OC) {
        mensajes.push(`La OC tiene ${filas.length} líneas y el máximo es ${MAX_LINEAS_POR_OC}`);
      }
      for (const campo of CAMPOS_CABECERA) {
        const valores = new Set(filas.map((f) => f.dto[campo]?.toString().trim()).filter(Boolean).map((v) => (campo === 'moneda' ? v!.toUpperCase() : v)));
        if (valores.size > 1) {
          mensajes.push(`El campo «${campo}» trae valores distintos entre las filas de la OC`);
        }
      }
      const cabecera = Object.fromEntries(
        CAMPOS_CABECERA.map((c) => [c, filas.map((f) => f.dto[c]).find((v) => v !== undefined && v !== '')]),
      ) as Partial<Record<(typeof CAMPOS_CABECERA)[number], string>>;

      let proveedorId: string | null = null;
      let proveedorNuevo: string | null = null;
      let taxIdNuevo: string | null = null;
      let proveedorEtiqueta: string | null = cabecera.proveedor ?? cabecera.proveedorTaxId ?? null;

      if (!cabecera.proveedor && !cabecera.proveedorTaxId) {
        mensajes.push('Falta el proveedor (nombre o RUC/Tax ID)');
      } else {
        const porRuc = cabecera.proveedorTaxId ? porTaxId.get(norm(cabecera.proveedorTaxId)) : undefined;
        const porNom = cabecera.proveedor ? porNombre.get(norm(cabecera.proveedor)) : undefined;
        const candidatos = porRuc ?? porNom ?? [];
        if (candidatos.length === 1) {
          proveedorId = candidatos[0].id;
          proveedorEtiqueta = candidatos[0].nombre;
        } else if (candidatos.length > 1) {
          mensajes.push(`Hay ${candidatos.length} proveedores con ese ${porRuc ? 'RUC' : 'nombre'}; indica el RUC/Tax ID para elegir uno`);
        } else if (dto.crearProveedores && cabecera.proveedor) {
          proveedorNuevo = cabecera.proveedor.trim();
          taxIdNuevo = cabecera.proveedorTaxId?.trim() || null;
        } else {
          mensajes.push(
            `Proveedor no encontrado: «${proveedorEtiqueta}». Créalo en Contactos o activa «crear proveedores que no existan»`,
          );
        }
      }

      const existente = estadoExistente.get(numero);
      if (mensajes.length > 0) {
        resultados.push({ numero, estado: 'error', lineas: filas.length, proveedor: proveedorEtiqueta, mensajes });
      } else if (existente) {
        resultados.push({ numero, estado: 'omitida', lineas: filas.length, proveedor: proveedorEtiqueta, mensajes: [`Ya existe en tu empresa (${existente}); no se modifica`] });
      } else {
        resultados.push({
          numero,
          estado: 'nueva',
          lineas: filas.length,
          proveedor: proveedorEtiqueta,
          mensajes: proveedorNuevo ? [`Se creará el proveedor «${proveedorNuevo}»`] : [],
        });
        aCrear.push({ numero, proveedorId, proveedorNuevo, taxIdNuevo, filas });
        // El proveedor nuevo solo se crea si su OC realmente se importa.
        if (proveedorNuevo) {
          const clave = norm(taxIdNuevo) || norm(proveedorNuevo);
          if (!proveedoresNuevos.has(clave)) proveedoresNuevos.set(clave, { nombre: proveedorNuevo, taxId: taxIdNuevo });
        }
      }
    }

    // 4) Guardar (salvo simulación). Cada OC es atómica por sí sola: si una
    //    falla, las demás igual se importan y la falla queda informada.
    if (!dto.simular) {
      const idsNuevos = new Map<string, string>();
      for (const [clave, p] of proveedoresNuevos) {
        const creado = await this.prisma.partner.create({
          data: { tenantId, tipo: 'proveedor', nombre: p.nombre, taxId: p.taxId },
          select: { id: true },
        });
        idsNuevos.set(clave, creado.id);
      }
      for (const oc of aCrear) {
        const resultado = resultados.find((r) => r.numero === oc.numero)!;
        const proveedorId =
          oc.proveedorId ?? idsNuevos.get(norm(oc.taxIdNuevo) || norm(oc.proveedorNuevo))!;
        const valorCabecera = (c: (typeof CAMPOS_CABECERA)[number]) =>
          oc.filas.map((f) => f.dto[c]).find((v) => v !== undefined && v !== '');
        try {
          await this.prisma.purchaseOrder.create({
            data: {
              tenantId,
              numero: oc.numero,
              proveedorId,
              creadoPorId: userId,
              incoterm: valorCabecera('incoterm') ?? null,
              moneda: valorCabecera('moneda')?.toUpperCase(),
              fechaEmision: valorCabecera('fechaEmision') ? new Date(valorCabecera('fechaEmision')!) : undefined,
              fechaRequerida: valorCabecera('fechaRequerida') ? new Date(valorCabecera('fechaRequerida')!) : undefined,
              fechaConfirmadaProveedor: valorCabecera('fechaConfirmadaProveedor') ? new Date(valorCabecera('fechaConfirmadaProveedor')!) : undefined,
              notas: valorCabecera('notas') ?? null,
              lineas: {
                create: oc.filas.map(({ dto: l }) => ({
                  tenantId,
                  sku: l.sku.trim(),
                  descripcion: l.descripcion,
                  cantidad: l.cantidad,
                  unidad: l.unidad,
                  precioUnitario: l.precioUnitario,
                })),
              },
            },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            resultado.estado = 'omitida';
            resultado.mensajes = ['Ya existe en tu empresa; no se modifica'];
          } else {
            resultado.estado = 'error';
            resultado.mensajes = ['No se pudo guardar esta OC; revisa los datos e inténtalo de nuevo'];
          }
        }
      }
    }

    return {
      simular: !!dto.simular,
      resumen: {
        filas: dto.filas.length,
        ordenes: resultados.length,
        nuevas: resultados.filter((r) => r.estado === 'nueva').length,
        omitidas: resultados.filter((r) => r.estado === 'omitida').length,
        conErrores: resultados.filter((r) => r.estado === 'error').length,
        filasConErrores: errores.length,
        proveedoresACrear: proveedoresNuevos.size,
      },
      ordenes: resultados,
      errores,
    };
  }
}
