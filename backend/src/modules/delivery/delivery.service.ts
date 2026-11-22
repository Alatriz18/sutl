import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, RolUsuario } from '@prisma/client';
import { closeSync, openSync, readSync, unlinkSync } from 'fs';
import { join } from 'path';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { descartarArchivo, exigirContenidoValido } from '../../common/uploads';
import { AuditService } from '../audit/audit.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { TrackingEventsService } from '../tracking-events/tracking-events.service';
import { RegisterPodDto } from './dto/register-pod.dto';

const EPS = 1e-9;
const CABECERA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Una firma debe ser de verdad un PNG: se comprueba el contenido, no solo la extensión.
function esPng(ruta: string): boolean {
  try {
    const fd = openSync(ruta, 'r');
    try {
      const cab = Buffer.alloc(8);
      readSync(fd, cab, 0, 8, 0);
      return cab.equals(CABECERA_PNG);
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

export interface ResultadoRecepcionOc {
  numero: string;
  ok: boolean;
  error?: string;
}

// Prueba de entrega (POD): constancia de la llegada y, si se pide, recepción de las
// órdenes de compra cuya carga viajaba en el envío. Toda consulta filtra por empresa.
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingEventsService,
    private readonly ordenes: PurchaseOrdersService,
    private readonly audit: AuditService,
  ) {}

  private select = {
    id: true,
    receptorNombre: true,
    receptorDocumento: true,
    entregadoAt: true,
    observaciones: true,
    archivoNombre: true,
    createdAt: true,
    registradoPor: { select: { nombre: true } },
  } as const;

  // El cliente final solo ve la prueba de SUS envíos; el equipo, la de cualquiera de su empresa.
  private async envioVisible(user: RequestUser, shipmentId: string) {
    const envio = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        tenantId: user.tenantId,
        ...(user.rol === RolUsuario.cliente_final ? { destinatarioEmail: { equals: user.email, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true, codigoGuia: true, destino: true },
    });
    if (!envio) throw new NotFoundException('Envío no encontrado');
    return envio;
  }

  async obtener(user: RequestUser, shipmentId: string) {
    await this.envioVisible(user, shipmentId);
    const pod = await this.prisma.proofOfDelivery.findFirst({ where: { shipmentId, tenantId: user.tenantId }, select: { ...this.select, archivoUrl: true, firmaUrl: true } });
    if (!pod) return null;
    const { archivoUrl, firmaUrl, ...publico } = pod;
    return { ...publico, tieneArchivo: !!archivoUrl, tieneFirma: !!firmaUrl };
  }

  async archivo(user: RequestUser, shipmentId: string) {
    await this.envioVisible(user, shipmentId);
    const pod = await this.prisma.proofOfDelivery.findFirst({ where: { shipmentId, tenantId: user.tenantId }, select: { archivoUrl: true, archivoNombre: true } });
    if (!pod?.archivoUrl) throw new NotFoundException('Esta entrega no tiene evidencia adjunta');
    return { ruta: pod.archivoUrl, nombre: pod.archivoNombre ?? 'evidencia' };
  }

  async firma(user: RequestUser, shipmentId: string) {
    await this.envioVisible(user, shipmentId);
    const pod = await this.prisma.proofOfDelivery.findFirst({ where: { shipmentId, tenantId: user.tenantId }, select: { firmaUrl: true } });
    if (!pod?.firmaUrl) throw new NotFoundException('Esta entrega no tiene firma');
    return { ruta: pod.firmaUrl };
  }

  async registrar(user: RequestUser, shipmentId: string, dto: RegisterPodDto, archivo?: { filename: string; originalname: string; path?: string }, firma?: { filename: string; path?: string }) {
    const envio = await this.envioVisible(user, shipmentId).catch((e) => {
      this.descartar(firma?.path);
      descartarArchivo(archivo);
      throw e;
    });
    if (archivo) {
      try {
        exigirContenidoValido(archivo as { path?: string; originalname: string });
      } catch (e) {
        this.descartar(firma?.path);
        throw e;
      }
    }
    if (firma && firma.path && !esPng(firma.path)) {
      descartarArchivo(archivo);
      this.descartar(firma.path);
      throw new BadRequestException('La firma no es una imagen PNG válida');
    }
    const entregadoAt = dto.entregadoAt ? new Date(dto.entregadoAt) : new Date();
    // Nadie recibe en el futuro: un día de margen por diferencias de reloj.
    if (entregadoAt.getTime() > Date.now() + 86_400_000) throw new BadRequestException('La fecha de entrega no puede estar en el futuro');

    let pod: { id: string };
    try {
      pod = await this.prisma.proofOfDelivery.create({
        data: {
          tenantId: user.tenantId,
          shipmentId,
          receptorNombre: dto.receptorNombre.trim(),
          receptorDocumento: dto.receptorDocumento?.trim() || null,
          entregadoAt,
          observaciones: dto.observaciones?.trim() || null,
          archivoUrl: archivo ? `/uploads/${user.tenantId}/${archivo.filename}` : null,
          archivoNombre: archivo?.originalname ?? null,
          firmaUrl: firma ? `/uploads/${user.tenantId}/${firma.filename}` : null,
          registradoPorId: user.userId,
        },
        select: { id: true },
      });
    } catch (e) {
      // Único por envío: una segunda prueba se rechaza en vez de duplicarse.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Este envío ya tiene su prueba de entrega');
      throw e;
    }

    try {
      // El evento deja el envío en «entregado» (el estado sigue al último evento).
      await this.tracking.create(user.tenantId, user.email, {
        shipmentId,
        estado: 'entregado',
        ubicacion: envio.destino,
        descripcion: `Entregado a ${dto.receptorNombre.trim()}`,
      });
    } catch (e) {
      await this.prisma.proofOfDelivery.deleteMany({ where: { id: pod.id, tenantId: user.tenantId } });
      throw e;
    }

    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'pod.registrado',
      entidad: 'envio',
      entidadId: shipmentId,
      metadata: { guia: envio.codigoGuia, receptor: dto.receptorNombre.trim(), conEvidencia: !!archivo, conFirma: !!firma, recibirOc: !!dto.recibirOc },
    });

    const recepciones = dto.recibirOc ? await this.recibirOrdenes(user, shipmentId, dto) : [];
    return { pod: await this.obtener(user, shipmentId), recepciones };
  }

  private descartar(ruta?: string) {
    if (!ruta) return;
    try {
      unlinkSync(join(process.cwd(), ruta));
    } catch {
      try {
        unlinkSync(ruta);
      } catch {
        // ya no estaba
      }
    }
  }

  // Recibe en cada OC la carga que viajaba en este envío (lo que falta por recibir, nunca más).
  // Cada OC es independiente: si una falla (p. ej. aún no está confirmada) las demás siguen y la
  // prueba de entrega queda registrada igual; el resultado dice qué pasó con cada una.
  private async recibirOrdenes(user: RequestUser, shipmentId: string, dto: RegisterPodDto): Promise<ResultadoRecepcionOc[]> {
    const vinculos = await this.prisma.shipmentPurchaseOrderLine.findMany({
      where: { tenantId: user.tenantId, shipmentId },
      select: { cantidad: true, linea: { select: { id: true, cantidad: true, cantidadRecibida: true, purchaseOrder: { select: { id: true, numero: true } } } } },
    });
    const porOc = new Map<string, { numero: string; lineas: { lineaId: string; cantidad: number }[] }>();
    for (const v of vinculos) {
      const pendiente = v.linea.cantidad - v.linea.cantidadRecibida;
      const cantidad = Math.min(v.cantidad, pendiente);
      if (cantidad <= EPS) continue;
      const g = porOc.get(v.linea.purchaseOrder.id) ?? { numero: v.linea.purchaseOrder.numero, lineas: [] };
      g.lineas.push({ lineaId: v.linea.id, cantidad });
      porOc.set(v.linea.purchaseOrder.id, g);
    }

    const resultados: ResultadoRecepcionOc[] = [];
    for (const [ocId, g] of porOc) {
      try {
        await this.ordenes.registrarRecepcion(user.tenantId, user.userId, ocId, {
          lineas: g.lineas,
          notas: 'Recepción por prueba de entrega',
          warehouseId: dto.warehouseId,
          actualizarInventario: dto.actualizarInventario,
        });
        resultados.push({ numero: g.numero, ok: true });
      } catch (e) {
        this.logger.warn(`La recepción de ${g.numero} por POD no se pudo registrar: ${(e as Error).message}`);
        resultados.push({ numero: g.numero, ok: false, error: (e as Error).message });
      }
    }
    return resultados;
  }
}
