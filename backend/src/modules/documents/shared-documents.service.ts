import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, RolUsuario, TipoDocumento } from '@prisma/client';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompartirDocumentDto } from './dto/compartir-document.dto';

const ROLES_EQUIPO: RolUsuario[] = [RolUsuario.admin_tenant, RolUsuario.operador, RolUsuario.super_admin, RolUsuario.analista_sutl];

// Qué puede subir cada externo: lo que le corresponde aportar. Así un externo no puede reemplazar
// la versión vigente de un BL, un AWB o un pedimento que maneja el equipo.
export const TIPOS_EXTERNOS: Partial<Record<RolUsuario, TipoDocumento[]>> = {
  proveedor: [TipoDocumento.factura, TipoDocumento.packing_list, TipoDocumento.otro],
  cliente_final: [TipoDocumento.otro],
};

const SELECT = {
  id: true,
  tipo: true,
  version: true,
  estado: true,
  nombreArchivo: true,
  fechaVencimiento: true,
  motivoRechazo: true,
  createdAt: true,
  visibleCliente: true,
  visibleProveedor: true,
  subidoPorId: true,
  subidoPor: { select: { nombre: true, rol: true, partnerId: true } },
} satisfies Prisma.DocumentSelect;

type Fila = Prisma.DocumentGetPayload<{ select: typeof SELECT }>;

// Documentos compartidos con el proveedor y el cliente final. Toda la autorización vive aquí:
// un externo solo llega a documentos de SU operación que el equipo compartió (o que él mismo subió);
// lo demás responde 404, igual que lo inexistente.
@Injectable()
export class SharedDocumentsService {
  private readonly logger = new Logger(SharedDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  private esEquipo(user: RequestUser) {
    return ROLES_EQUIPO.includes(user.rol);
  }

  private async partnerDe(user: RequestUser) {
    const u = await this.prisma.user.findFirst({ where: { id: user.userId, tenantId: user.tenantId }, select: { partnerId: true } });
    return u?.partnerId ?? null;
  }

  // El envío al que el usuario puede acceder: del equipo, todos los de su empresa; del cliente final,
  // los suyos; del proveedor, los que traen mercadería de sus órdenes de compra.
  private async envio(user: RequestUser, shipmentId: string) {
    const base = { id: shipmentId, tenantId: user.tenantId };
    let where: Prisma.ShipmentWhereInput = base;
    if (user.rol === RolUsuario.cliente_final) {
      where = { ...base, destinatarioEmail: { equals: user.email, mode: 'insensitive' } };
    } else if (user.rol === RolUsuario.proveedor) {
      const partnerId = await this.partnerDe(user);
      if (!partnerId) throw new NotFoundException('Envío no encontrado');
      where = { ...base, ordenesCompraLineas: { some: { linea: { purchaseOrder: { proveedorId: partnerId, estado: { not: 'borrador' } } } } } };
    } else if (!this.esEquipo(user)) {
      throw new ForbiddenException('Forbidden resource');
    }
    const envio = await this.prisma.shipment.findFirst({ where, select: { id: true, codigoGuia: true, destinatarioEmail: true } });
    if (!envio) throw new NotFoundException('Envío no encontrado');
    return envio;
  }

  // ¿Este usuario ve este documento? El equipo ve todo; un externo ve lo compartido con su lado y lo que subió
  // su propia empresa (un proveedor nunca ve lo que subió otro proveedor).
  private visiblePara(user: RequestUser, d: Fila, partnerId: string | null) {
    if (this.esEquipo(user)) return true;
    const subioEquipo = !!d.subidoPor && ROLES_EQUIPO.includes(d.subidoPor.rol);
    if (user.rol === RolUsuario.cliente_final) return d.visibleCliente && (subioEquipo || d.subidoPorId === user.userId || d.subidoPor?.rol === 'cliente_final');
    if (user.rol === RolUsuario.proveedor) return d.visibleProveedor && (subioEquipo || (!!partnerId && d.subidoPor?.partnerId === partnerId));
    return false;
  }

  private proyectar(user: RequestUser, d: Fila) {
    const base = {
      id: d.id,
      tipo: d.tipo,
      version: d.version,
      estado: d.estado,
      nombreArchivo: d.nombreArchivo,
      fechaVencimiento: d.fechaVencimiento,
      motivoRechazo: d.motivoRechazo,
      createdAt: d.createdAt,
    };
    if (this.esEquipo(user)) {
      return { ...base, visibleCliente: d.visibleCliente, visibleProveedor: d.visibleProveedor, subidoPor: d.subidoPor ? { nombre: d.subidoPor.nombre, rol: d.subidoPor.rol } : null };
    }
    // Un externo solo sabe si lo subió su lado o el equipo, nunca quién ni de qué otra empresa.
    return { ...base, origen: d.subidoPor && ROLES_EQUIPO.includes(d.subidoPor.rol) ? 'equipo' : 'propio' };
  }

  async listar(user: RequestUser, shipmentId: string) {
    await this.envio(user, shipmentId);
    const partnerId = user.rol === RolUsuario.proveedor ? await this.partnerDe(user) : null;
    const filas = await this.prisma.document.findMany({
      where: { tenantId: user.tenantId, shipmentId },
      select: SELECT,
      orderBy: [{ tipo: 'asc' }, { version: 'desc' }],
    });
    return filas.filter((d) => this.visiblePara(user, d, partnerId)).map((d) => this.proyectar(user, d));
  }

  // El equipo decide con quién se comparte cada documento.
  async compartir(user: RequestUser, id: string, dto: CompartirDocumentDto) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId: user.tenantId }, select: { ...SELECT, shipmentId: true } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    const data: Prisma.DocumentUpdateInput = {};
    if (dto.visibleCliente !== undefined) data.visibleCliente = dto.visibleCliente;
    if (dto.visibleProveedor !== undefined) data.visibleProveedor = dto.visibleProveedor;
    if (Object.keys(data).length === 0) throw new BadRequestException('Indica con quién compartir');
    // updateMany con el tenant: aunque algo cambie entre la lectura y la escritura, nunca toca otra empresa.
    const r = await this.prisma.document.updateMany({ where: { id, tenantId: user.tenantId }, data: data as Prisma.DocumentUpdateManyMutationInput });
    if (r.count === 0) throw new NotFoundException('Documento no encontrado');
    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'documento.compartido',
      entidad: 'documento',
      entidadId: id,
      metadata: { visibleCliente: dto.visibleCliente ?? doc.visibleCliente, visibleProveedor: dto.visibleProveedor ?? doc.visibleProveedor },
    });
    const nuevos = {
      cliente: dto.visibleCliente === true && !doc.visibleCliente,
      proveedor: dto.visibleProveedor === true && !doc.visibleProveedor,
    };
    if (nuevos.cliente || nuevos.proveedor) await this.avisarCompartido(user, doc.shipmentId, doc.tipo, nuevos);
    return { id, visibleCliente: dto.visibleCliente ?? doc.visibleCliente, visibleProveedor: dto.visibleProveedor ?? doc.visibleProveedor };
  }

  // Un externo sube un documento de su operación: queda pendiente de revisión y solo lo ve su lado y el equipo.
  async subirExterno(user: RequestUser, shipmentId: string, tipo: TipoDocumento, fechaVencimiento: string | undefined, file: Express.Multer.File) {
    const permitidos = TIPOS_EXTERNOS[user.rol];
    if (!permitidos) throw new ForbiddenException('Forbidden resource');
    const envio = await this.envio(user, shipmentId);
    if (!permitidos.includes(tipo)) throw new BadRequestException(`Solo puedes subir documentos de tipo: ${permitidos.join(', ')}`);
    const anterior = await this.prisma.document.findFirst({ where: { tenantId: user.tenantId, shipmentId, tipo }, orderBy: { version: 'desc' }, select: { version: true } });
    const creado = await this.prisma.document.create({
      data: {
        tenantId: user.tenantId,
        shipmentId,
        tipo,
        nombreArchivo: file.originalname,
        urlArchivo: `/uploads/${user.tenantId}/${file.filename}`,
        version: anterior ? anterior.version + 1 : 1,
        subidoPorId: user.userId,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        visibleCliente: user.rol === RolUsuario.cliente_final,
        visibleProveedor: user.rol === RolUsuario.proveedor,
      },
      select: SELECT,
    });
    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'documento.subido_externo',
      entidad: 'documento',
      entidadId: creado.id,
      metadata: { tipo, version: creado.version, envio: envio.codigoGuia, rol: user.rol },
    });
    await this.avisarEquipo(user, envio.codigoGuia, tipo);
    return this.proyectar(user, creado);
  }

  // Para descargar: el mismo criterio de visibilidad que el listado. Devuelve la ruta y el nombre.
  async paraDescarga(user: RequestUser, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId: user.tenantId }, select: { ...SELECT, shipmentId: true, urlArchivo: true } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (!this.esEquipo(user)) {
      // Un externo debe además seguir teniendo acceso al envío.
      await this.envio(user, doc.shipmentId);
      const partnerId = user.rol === RolUsuario.proveedor ? await this.partnerDe(user) : null;
      if (!this.visiblePara(user, doc, partnerId)) throw new NotFoundException('Documento no encontrado');
    }
    return { urlArchivo: doc.urlArchivo, nombreArchivo: doc.nombreArchivo };
  }

  // Avisos por correo: nunca rompen la operación; un correo que falla solo queda en el log.
  private async avisarEquipo(user: RequestUser, guia: string, tipo: TipoDocumento) {
    if (!this.notifications) return;
    try {
      const admins = await this.prisma.user.findMany({ where: { tenantId: user.tenantId, rol: 'admin_tenant', activo: true }, select: { id: true, email: true } });
      for (const a of admins) {
        await this.notifications
          .create(user.tenantId, {
            canal: 'email',
            tipo: 'portal_documento',
            asunto: `SUTL: documento nuevo en el envío ${guia}`,
            mensaje: `Se subió un documento (${tipo}) al envío ${guia} desde el portal. Queda pendiente de tu revisión en SUTL.`,
            destino: a.email,
            userId: a.id,
          })
          .catch((e: Error) => this.logger.warn(`No se pudo avisar del documento (${guia}): ${e.message}`));
      }
    } catch (e) {
      this.logger.error(`Falló el aviso de documento (${guia}): ${(e as Error).message}`);
    }
  }

  private async avisarCompartido(user: RequestUser, shipmentId: string, tipo: TipoDocumento, quien: { cliente: boolean; proveedor: boolean }) {
    if (!this.notifications) return;
    try {
      const envio = await this.prisma.shipment.findFirst({ where: { id: shipmentId, tenantId: user.tenantId }, select: { codigoGuia: true, destinatarioEmail: true } });
      if (!envio) return;
      const destinos: { id: string; email: string }[] = [];
      if (quien.cliente && envio.destinatarioEmail) {
        destinos.push(...(await this.prisma.user.findMany({ where: { tenantId: user.tenantId, rol: 'cliente_final', activo: true, email: { equals: envio.destinatarioEmail, mode: 'insensitive' } }, select: { id: true, email: true } })));
      }
      if (quien.proveedor) {
        destinos.push(
          ...(await this.prisma.user.findMany({
            where: { tenantId: user.tenantId, rol: 'proveedor', activo: true, partner: { ordenesCompra: { some: { estado: { not: 'borrador' }, lineas: { some: { embarques: { some: { shipmentId } } } } } } } },
            select: { id: true, email: true },
          })),
        );
      }
      for (const d of destinos) {
        await this.notifications
          .create(user.tenantId, {
            canal: 'email',
            tipo: 'portal_documento',
            asunto: `SUTL: nuevo documento del envío ${envio.codigoGuia}`,
            mensaje: `La empresa compartió contigo un documento (${tipo}) del envío ${envio.codigoGuia}. Entra a SUTL para verlo.`,
            destino: d.email,
            userId: d.id,
          })
          .catch((e: Error) => this.logger.warn(`No se pudo avisar del documento compartido (${envio.codigoGuia}): ${e.message}`));
      }
    } catch (e) {
      this.logger.error(`Falló el aviso de documento compartido: ${(e as Error).message}`);
    }
  }
}
