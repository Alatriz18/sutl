import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PurchaseOrderShipmentsService } from '../purchase-orders/purchase-order-shipments.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { DespacharOrdenDto } from './dto/portal.dto';

const DIA_MS = 86_400_000;
// Un despacho se registra cuando ocurre: no se acepta uno de hace más de un mes ni uno del futuro.
const MAX_ANTIGUEDAD_DIAS = 30;
// Tope de embarques que un proveedor puede crear por orden (despachos parciales razonables).
const MAX_EMBARQUES_POR_OC = 50;

const ESTADOS_DESPACHABLES = ['confirmada', 'despachada', 'recibida_parcial'];

// El proveedor registra el despacho real de SU orden: se crea el embarque (con el proveedor como remitente y la
// empresa como destinataria), se le asigna la carga con las mismas reglas de cantidades que usa el equipo y la
// orden pasa a «despachada» con la fecha real. Todo lo ajeno responde 404, igual que lo inexistente.
@Injectable()
export class PortalDespachoService {
  private readonly logger = new Logger(PortalDespachoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ordenes: PurchaseOrdersService,
    private readonly vinculos: PurchaseOrderShipmentsService,
    private readonly envios: ShipmentsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async despachar(user: RequestUser, ocId: string, dto: DespacharOrdenDto) {
    const partnerId = await this.ordenes.proveedorDe(user.tenantId, user.userId);
    const orden = await this.ordenes.findOneDeProveedor(user.tenantId, partnerId, ocId);
    if (!ESTADOS_DESPACHABLES.includes(orden.estado)) {
      throw new BadRequestException('Solo se puede registrar el despacho de una orden que ya confirmaste y que no está cerrada');
    }

    const fechaDespacho = new Date(dto.fechaDespacho);
    const ahora = Date.now();
    if (Number.isNaN(fechaDespacho.getTime()) || fechaDespacho.getTime() > ahora + DIA_MS) {
      throw new BadRequestException('La fecha de despacho no puede estar en el futuro');
    }
    if (fechaDespacho.getTime() < ahora - MAX_ANTIGUEDAD_DIAS * DIA_MS) {
      throw new BadRequestException(`La fecha de despacho no puede ser de hace más de ${MAX_ANTIGUEDAD_DIAS} días`);
    }
    const llegada = dto.fechaEstimadaLlegada ? new Date(dto.fechaEstimadaLlegada) : null;
    if (llegada && (Number.isNaN(llegada.getTime()) || llegada.getTime() < fechaDespacho.getTime() - DIA_MS)) {
      throw new BadRequestException('La llegada estimada no puede ser anterior al despacho');
    }

    const lineasDeLaOrden = new Set(orden.lineas.map((l) => l.id));
    const vistas = new Set<string>();
    for (const l of dto.lineas) {
      if (!lineasDeLaOrden.has(l.lineaId)) throw new BadRequestException(`La línea ${l.lineaId} no pertenece a esta orden`);
      if (vistas.has(l.lineaId)) throw new BadRequestException(`La línea ${l.lineaId} está repetida`);
      vistas.add(l.lineaId);
    }

    const [tenant, proveedor, creados] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { nombre: true } }),
      this.prisma.partner.findFirst({ where: { id: partnerId, tenantId: user.tenantId }, select: { nombre: true } }),
      this.prisma.shipmentPurchaseOrderLine.findMany({
        where: { tenantId: user.tenantId, linea: { purchaseOrderId: ocId } },
        distinct: ['shipmentId'],
        select: { shipmentId: true },
      }),
    ]);
    if (creados.length >= MAX_EMBARQUES_POR_OC) {
      throw new BadRequestException('Esta orden ya tiene demasiados embarques; contacta a la empresa');
    }

    const embarque = await this.envios.create(
      user.tenantId,
      {
        tipo: 'importacion',
        modo: dto.modo,
        origen: dto.origen,
        destino: dto.destino,
        remitenteNombre: proveedor?.nombre ?? 'Proveedor',
        destinatarioNombre: tenant?.nombre ?? 'Empresa',
        ...(dto.referenciaDocumento ? { referenciaDocumento: dto.referenciaDocumento } : {}),
        fechaEstimadaSalida: fechaDespacho.toISOString(),
        ...(llegada ? { fechaEstimadaLlegada: llegada.toISOString() } : {}),
        ...(dto.pesoKg ? { pesoKg: dto.pesoKg } : {}),
      },
      { avisar: false },
    );

    try {
      // Las reglas de cantidades (no pasar de lo pedido, tolerancia de la empresa) son las del equipo.
      await this.vinculos.vincular(user.tenantId, ocId, { shipmentId: embarque.id, lineas: dto.lineas });
      await this.fijarFechaDespacho(user.tenantId, ocId, orden.estado, fechaDespacho);
    } catch (e) {
      // Nada a medias: si no se pudo asignar la carga, el embarque recién creado se deshace.
      await this.prisma.shipment.deleteMany({ where: { id: embarque.id, tenantId: user.tenantId } });
      throw e;
    }

    this.envios.publicarCreado(embarque);
    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'portal.orden_despachada',
      entidad: 'orden_compra',
      entidadId: ocId,
      metadata: { numero: orden.numero, codigoGuia: embarque.codigoGuia, fechaDespacho: fechaDespacho.toISOString(), lineas: dto.lineas.length },
    });
    await this.avisar(user.tenantId, user.userId, orden.numero, embarque.codigoGuia, fechaDespacho);
    return this.ordenes.findOneDeProveedor(user.tenantId, partnerId, ocId);
  }

  // La orden queda «despachada» con la fecha REAL que informó el proveedor (no la hora en que se registró).
  private async fijarFechaDespacho(tenantId: string, ocId: string, estadoPrevio: string, fecha: Date) {
    if (estadoPrevio === 'confirmada') {
      const actual = await this.ordenes.findOne(tenantId, ocId);
      if (actual.estado === 'confirmada') {
        await this.ordenes.transicion(tenantId, ocId, { estado: 'despachada', fechaDespacho: fecha.toISOString() });
      } else if (actual.estado === 'despachada') {
        // La regla de la empresa («vincular un embarque despacha la OC») ya la despachó con la hora de ahora.
        await this.prisma.purchaseOrder.updateMany({ where: { id: ocId, tenantId, estado: 'despachada' }, data: { fechaDespacho: fecha } });
      }
    }
  }

  private async avisar(tenantId: string, userId: string, numero: string, codigoGuia: string, fecha: Date) {
    if (!this.notifications) return;
    try {
      const admins = await this.prisma.user.findMany({ where: { tenantId, rol: 'admin_tenant', activo: true }, select: { id: true, email: true } });
      for (const a of admins.filter((x) => x.id !== userId)) {
        try {
          await this.notifications.create(tenantId, {
            canal: 'email',
            tipo: 'portal_mensaje',
            asunto: `SUTL: el proveedor despachó la orden ${numero}`,
            mensaje: `El proveedor registró el despacho de la orden de compra ${numero} el ${fecha.toISOString().slice(0, 10)}.\n\nSe creó el embarque ${codigoGuia}. Entra a SUTL para darle seguimiento.`,
            destino: a.email,
            userId: a.id,
          });
        } catch (e) {
          this.logger.warn(`No se pudo avisar del despacho de ${numero}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.logger.error(`Falló el aviso del despacho de ${numero}: ${(e as Error).message}`);
    }
  }
}
