import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';

export type EntidadPortal = 'orden_compra' | 'envio';

const ROLES_EQUIPO: RolUsuario[] = [RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.analista_sutl];
const DIA_MS = 86_400_000;
const MAX_MENSAJES = 200;

interface ContextoEntidad {
  // Quién más debe enterarse cuando el equipo escribe (correos de los externos de esta operación).
  externos: { id: string; email: string }[];
  etiqueta: string;
}

// Portal colaborativo: conversación y acciones de los externos (proveedor y cliente
// final) sobre SU operación. Toda la autorización vive aquí: un externo solo llega a
// lo suyo, y lo ajeno responde 404, igual que lo inexistente.
@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ordenes: PurchaseOrdersService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private esEquipo(user: RequestUser) {
    return ROLES_EQUIPO.includes(user.rol);
  }

  // Comprueba que el usuario puede ver esta operación y devuelve lo necesario para avisar al otro lado.
  private async contexto(user: RequestUser, tipo: EntidadPortal, id: string): Promise<ContextoEntidad> {
    if (tipo === 'orden_compra') {
      if (user.rol === RolUsuario.cliente_final) throw new ForbiddenException('No tienes acceso a las órdenes de compra');
      const partnerId = user.rol === RolUsuario.proveedor ? await this.ordenes.proveedorDe(user.tenantId, user.userId) : undefined;
      const orden = await this.prisma.purchaseOrder.findFirst({
        where: { id, tenantId: user.tenantId, ...(partnerId ? { proveedorId: partnerId, estado: { not: 'borrador' } } : {}) },
        select: { numero: true, proveedorId: true },
      });
      if (!orden) throw new NotFoundException('Orden de compra no encontrada');
      const externos = await this.prisma.user.findMany({
        where: { tenantId: user.tenantId, rol: 'proveedor', partnerId: orden.proveedorId, activo: true },
        select: { id: true, email: true },
      });
      return { externos, etiqueta: `la orden de compra ${orden.numero}` };
    }

    if (user.rol === RolUsuario.proveedor) throw new ForbiddenException('No tienes acceso a los envíos');
    const envio = await this.prisma.shipment.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...(user.rol === RolUsuario.cliente_final ? { destinatarioEmail: { equals: user.email, mode: 'insensitive' as const } } : {}),
      },
      select: { codigoGuia: true, destinatarioEmail: true },
    });
    if (!envio) throw new NotFoundException('Envío no encontrado');
    const externos = envio.destinatarioEmail
      ? await this.prisma.user.findMany({
          where: { tenantId: user.tenantId, rol: 'cliente_final', email: { equals: envio.destinatarioEmail, mode: 'insensitive' }, activo: true },
          select: { id: true, email: true },
        })
      : [];
    return { externos, etiqueta: `el envío ${envio.codigoGuia}` };
  }

  async listar(user: RequestUser, tipo: EntidadPortal, id: string) {
    await this.contexto(user, tipo, id);
    const mensajes = await this.prisma.portalMessage.findMany({
      where: { tenantId: user.tenantId, entidadTipo: tipo, entidadId: id },
      orderBy: { createdAt: 'asc' },
      take: MAX_MENSAJES,
      select: { id: true, texto: true, createdAt: true, autor: { select: { id: true, nombre: true, rol: true } } },
    });
    // El otro lado solo necesita saber si habló el equipo o un externo; no el rol exacto.
    return mensajes.map((m) => ({
      id: m.id,
      texto: m.texto,
      createdAt: m.createdAt,
      autor: { id: m.autor.id, nombre: m.autor.nombre },
      delEquipo: ROLES_EQUIPO.includes(m.autor.rol),
    }));
  }

  async publicar(user: RequestUser, tipo: EntidadPortal, id: string, textoCrudo: string) {
    const texto = textoCrudo.trim();
    if (!texto) throw new BadRequestException('Escribe un mensaje');
    const ctx = await this.contexto(user, tipo, id);
    const creado = await this.prisma.portalMessage.create({
      data: { tenantId: user.tenantId, entidadTipo: tipo, entidadId: id, autorId: user.userId, texto },
      select: { id: true, texto: true, createdAt: true },
    });
    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'portal.mensaje',
      entidad: tipo === 'orden_compra' ? 'orden_compra' : 'envio',
      entidadId: id,
      metadata: { externo: !this.esEquipo(user) },
    });
    await this.avisar(user, ctx, texto);
    return { ...creado, autor: { id: user.userId, nombre: null }, delEquipo: this.esEquipo(user) };
  }

  // Confirma una orden emitida: el proveedor se compromete a una fecha de despacho.
  async confirmarOrden(user: RequestUser, id: string, fechaConfirmada: string) {
    const partnerId = await this.ordenes.proveedorDe(user.tenantId, user.userId);
    const orden = await this.ordenes.findOneDeProveedor(user.tenantId, partnerId, id);
    if (orden.estado !== 'emitida') {
      throw new BadRequestException('Solo se puede confirmar una orden que la empresa ya emitió y que aún no confirmaste');
    }
    const fecha = new Date(fechaConfirmada);
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() < Date.now() - DIA_MS) {
      throw new BadRequestException('La fecha comprometida no puede estar en el pasado');
    }
    await this.ordenes.transicion(user.tenantId, id, { estado: 'confirmada', fechaConfirmadaProveedor: fecha.toISOString() });
    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'portal.orden_confirmada',
      entidad: 'orden_compra',
      entidadId: id,
      metadata: { numero: orden.numero, fechaConfirmada: fecha.toISOString() },
    });
    await this.avisar(user, { externos: [], etiqueta: `la orden de compra ${orden.numero}` }, `El proveedor confirmó la orden y se comprometió a despacharla el ${fecha.toISOString().slice(0, 10)}.`);
    return this.ordenes.findOneDeProveedor(user.tenantId, partnerId, id);
  }

  // Aviso por correo al otro lado: si escribe un externo, a los administradores; si escribe el equipo, a los externos de esa operación.
  // Nunca rompe la operación: un correo que falla solo queda en el log.
  private async avisar(user: RequestUser, ctx: ContextoEntidad, texto: string) {
    if (!this.notifications) return;
    try {
      const destinatarios = this.esEquipo(user)
        ? ctx.externos
        : await this.prisma.user.findMany({ where: { tenantId: user.tenantId, rol: 'admin_tenant', activo: true }, select: { id: true, email: true } });
      const resumen = texto.length > 300 ? `${texto.slice(0, 300)}…` : texto;
      for (const d of destinatarios.filter((x) => x.id !== user.userId)) {
        try {
          await this.notifications.create(user.tenantId, {
            canal: 'email',
            tipo: 'portal_mensaje',
            asunto: `SUTL: novedad en ${ctx.etiqueta}`,
            mensaje: `Hay un mensaje nuevo sobre ${ctx.etiqueta}:\n\n${resumen}\n\nEntra a SUTL para responder.`,
            destino: d.email,
            userId: d.id,
          });
        } catch (e) {
          this.logger.warn(`No se pudo avisar por correo (${ctx.etiqueta}): ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.logger.error(`Falló el aviso del portal (${ctx.etiqueta}): ${(e as Error).message}`);
    }
  }
}
