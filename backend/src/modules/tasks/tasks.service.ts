import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoTarea, Prisma, RolUsuario } from '@prisma/client';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCommentDto, CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './dto/task.dto';

const ENTIDAD_BITACORA = 'tarea';
const esAdmin = (rol: RolUsuario) => rol === RolUsuario.admin_tenant || rol === RolUsuario.super_admin;

const PERSONA = { select: { id: true, nombre: true, email: true } } as const;
const INCLUIR = { asignadoA: PERSONA, creadoPor: PERSONA } as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(user: RequestUser, q: ListTasksQueryDto) {
    const where: Prisma.TaskWhereInput = {
      tenantId: user.tenantId,
      ...(q.estado ? { estado: q.estado } : {}),
      ...(q.mias === 'true' ? { asignadoAId: user.userId } : q.asignadoAId ? { asignadoAId: q.asignadoAId } : {}),
      ...(q.entidadTipo ? { entidadTipo: q.entidadTipo } : {}),
      ...(q.entidadId ? { entidadId: q.entidadId } : {}),
    };
    return this.prisma.task.findMany({
      where,
      include: { ...INCLUIR, _count: { select: { comentarios: true } } },
      orderBy: [{ fechaLimite: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async findOne(tenantId: string, id: string) {
    const tarea = await this.prisma.task.findFirst({
      where: { id, tenantId },
      include: {
        ...INCLUIR,
        comentarios: { include: { autor: PERSONA }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');
    const bitacora = await this.prisma.auditLog.findMany({
      where: { tenantId, entidad: ENTIDAD_BITACORA, entidadId: id },
      include: { user: PERSONA },
      orderBy: { createdAt: 'asc' },
    });
    return { ...tarea, bitacora };
  }

  async create(user: RequestUser, dto: CreateTaskDto) {
    if (dto.asignadoAId) await this.validarResponsable(user.tenantId, dto.asignadoAId);
    if (dto.entidadTipo) await this.validarEntidad(user.tenantId, dto.entidadTipo, dto.entidadId);
    const tarea = await this.prisma.task.create({
      data: {
        tenantId: user.tenantId,
        creadoPorId: user.userId,
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion?.trim() || null,
        prioridad: dto.prioridad,
        asignadoAId: dto.asignadoAId ?? null,
        fechaLimite: dto.fechaLimite ?? null,
        entidadTipo: dto.entidadTipo ?? null,
        entidadId: dto.entidadTipo ? dto.entidadId : null,
      },
      include: INCLUIR,
    });
    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'tarea.creada',
      entidad: ENTIDAD_BITACORA,
      entidadId: tarea.id,
      metadata: { titulo: tarea.titulo, asignadoAId: tarea.asignadoAId, entidadTipo: tarea.entidadTipo, entidadId: tarea.entidadId },
    });
    return tarea;
  }

  async update(user: RequestUser, id: string, dto: UpdateTaskDto) {
    const actual = await this.prisma.task.findFirst({ where: { id, tenantId: user.tenantId } });
    if (!actual) throw new NotFoundException('Tarea no encontrada');
    // Un operador solo toca lo suyo (la creó o se la asignaron); el administrador, todo.
    if (!esAdmin(user.rol) && actual.creadoPorId !== user.userId && actual.asignadoAId !== user.userId) {
      throw new ForbiddenException('Solo quien creó la tarea, su responsable o un administrador pueden modificarla');
    }
    if (actual.estado === EstadoTarea.cancelada && (dto.estado === undefined || dto.estado === EstadoTarea.cancelada)) {
      throw new ConflictException('La tarea está cancelada: reábrela antes de modificarla');
    }
    if (dto.asignadoAId) await this.validarResponsable(user.tenantId, dto.asignadoAId);

    const data: Prisma.TaskUncheckedUpdateManyInput = {};
    const cambios: Record<string, { de: unknown; a: unknown }> = {};
    const mover = (campo: string, nuevo: unknown, previo: unknown, igual: boolean = nuevo === previo) => {
      if (nuevo === undefined || igual) return;
      (data as Record<string, unknown>)[campo] = nuevo;
      cambios[campo] = { de: previo, a: nuevo };
    };
    mover('titulo', dto.titulo?.trim(), actual.titulo);
    mover('descripcion', dto.descripcion?.trim(), actual.descripcion);
    mover('prioridad', dto.prioridad, actual.prioridad);
    mover('asignadoAId', dto.asignadoAId, actual.asignadoAId);
    mover('fechaLimite', dto.fechaLimite, actual.fechaLimite, (dto.fechaLimite?.getTime() ?? null) === (actual.fechaLimite?.getTime() ?? null));
    mover('estado', dto.estado, actual.estado);

    if (dto.estado && dto.estado !== actual.estado) {
      data.completadaAt = dto.estado === EstadoTarea.hecha ? new Date() : null;
    }
    if (Object.keys(cambios).length === 0) {
      return this.prisma.task.findFirstOrThrow({ where: { id, tenantId: user.tenantId }, include: INCLUIR });
    }

    // Condicional en la versión leída: dos cambios simultáneos no se pisan en silencio.
    const { count } = await this.prisma.task.updateMany({
      where: { id, tenantId: user.tenantId, updatedAt: actual.updatedAt },
      data,
    });
    if (count === 0) throw new ConflictException('La tarea cambió mientras la editabas: recárgala e inténtalo de nuevo');

    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: cambios.estado ? `tarea.${String(cambios.estado.a)}` : 'tarea.modificada',
      entidad: ENTIDAD_BITACORA,
      entidadId: id,
      metadata: { cambios },
    });
    return this.prisma.task.findFirstOrThrow({ where: { id, tenantId: user.tenantId }, include: INCLUIR });
  }

  async comentar(user: RequestUser, id: string, dto: CreateCommentDto) {
    const tarea = await this.prisma.task.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');
    const comentario = await this.prisma.taskComment.create({
      data: { tenantId: user.tenantId, taskId: id, autorId: user.userId, texto: dto.texto.trim() },
      include: { autor: PERSONA },
    });
    await this.audit.registrar({
      tenantId: user.tenantId,
      userId: user.userId,
      accion: 'tarea.comentada',
      entidad: ENTIDAD_BITACORA,
      entidadId: id,
      metadata: { comentarioId: comentario.id },
    });
    return comentario;
  }

  // El responsable debe ser personal activo de la misma empresa (no un cliente final).
  private async validarResponsable(tenantId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, tenantId, activo: true }, select: { rol: true } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if (u.rol === RolUsuario.cliente_final) throw new BadRequestException('Una tarea no se puede asignar a un cliente final');
  }

  private async validarEntidad(tenantId: string, tipo: string, id?: string) {
    if (!id) throw new BadRequestException('Indica a qué operación se refiere la tarea');
    if (tipo === 'sku') return; // el SKU es un código libre de la empresa
    const existe =
      tipo === 'orden_compra'
        ? await this.prisma.purchaseOrder.count({ where: { id, tenantId } })
        : await this.prisma.shipment.count({ where: { id, tenantId } });
    if (existe === 0) throw new NotFoundException(tipo === 'orden_compra' ? 'Orden de compra no encontrada' : 'Envío no encontrado');
  }
}
