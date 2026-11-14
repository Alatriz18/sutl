import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Todo método recibe tenantId explícitamente y filtra por él: ningún query
// de este servicio puede cruzar datos entre tenants (ver CLAUDE.md).
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: this.publicSelect,
    });
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: this.publicSelect,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }

  async create(tenantId: string, dto: CreateUserDto, actorRol: RolUsuario, actorId?: string) {
    this.assertPuedeAsignarRol(dto.rol, actorRol);
    await this.validarProveedor(tenantId, dto.rol, dto.partnerId);
    const existente = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese email en este tenant');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...dto, password, tenantId },
      select: this.publicSelect,
    });
    await this.audit.registrar({ tenantId, userId: actorId, accion: 'usuario.creado', entidad: 'usuario', entidadId: user.id, metadata: { email: user.email, rol: user.rol } });
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, actorRol: RolUsuario, actorId?: string) {
    const objetivo = await this.findOne(tenantId, id);
    this.assertPuedeGestionar(objetivo.rol, actorRol);
    this.assertPuedeAsignarRol(dto.rol, actorRol);
    // El proveedor asociado debe seguir siendo coherente con el rol resultante.
    const rolFinal = dto.rol ?? objetivo.rol;
    const partnerFinal = rolFinal === RolUsuario.proveedor ? (dto.partnerId ?? objetivo.partnerId ?? undefined) : undefined;
    await this.validarProveedor(tenantId, rolFinal, partnerFinal);
    // tenantId repetido en el where (no solo en el findOne previo): defensa
    // en profundidad ante un futuro refactor que se salte el chequeo.
    const actualizado = await this.prisma.user.update({
      where: { id, tenantId },
      data: { ...dto, partnerId: partnerFinal ?? null },
      select: this.publicSelect,
    });
    // Se anota qué campos cambiaron: sobre todo roles y activación.
    await this.audit.registrar({
      tenantId,
      userId: actorId,
      accion: dto.rol && dto.rol !== objetivo.rol ? 'usuario.rol_cambiado' : 'usuario.modificado',
      entidad: 'usuario',
      entidadId: id,
      metadata: { campos: Object.keys(dto), ...(dto.rol ? { rolAnterior: objetivo.rol, rolNuevo: dto.rol } : {}) },
    });
    return actualizado;
  }

  async remove(tenantId: string, id: string, actorRol: RolUsuario, actorId?: string) {
    const objetivo = await this.findOne(tenantId, id);
    this.assertPuedeGestionar(objetivo.rol, actorRol);
    const desactivado = await this.prisma.user.update({
      where: { id, tenantId },
      data: { activo: false },
      select: this.publicSelect,
    });
    await this.audit.registrar({ tenantId, userId: actorId, accion: 'usuario.desactivado', entidad: 'usuario', entidadId: id });
    return desactivado;
  }

  // Solo un super_admin puede crear o ascender a otro super_admin. Sin esto,
  // un admin_tenant podría darse rol super_admin y saltar el aislamiento
  // multi-tenant (crear tenants, registrar usuarios en cualquier empresa).
  private assertPuedeAsignarRol(rol: RolUsuario | undefined, actorRol: RolUsuario) {
    // El analista de SUTL es personal de SUTL: solo un super_admin lo da de alta.
    const reservados: RolUsuario[] = [RolUsuario.super_admin, RolUsuario.analista_sutl];
    if (rol && reservados.includes(rol) && actorRol !== RolUsuario.super_admin) {
      throw new ForbiddenException('No tienes permiso para asignar ese rol');
    }
  }

  // El proveedor externo debe estar ligado a un proveedor activo de la misma empresa;
  // los demás roles no llevan proveedor asociado.
  private async validarProveedor(tenantId: string, rol: RolUsuario | undefined, partnerId: string | undefined) {
    if (rol === RolUsuario.proveedor) {
      if (!partnerId) throw new BadRequestException('Un usuario proveedor necesita el proveedor al que representa');
      const partner = await this.prisma.partner.findFirst({ where: { id: partnerId, tenantId, tipo: 'proveedor', activo: true }, select: { id: true } });
      if (!partner) throw new NotFoundException('Proveedor no encontrado');
    } else if (partnerId) {
      throw new BadRequestException('Solo un usuario con rol proveedor se asocia a un proveedor');
    }
  }

  // Un admin_tenant tampoco puede editar ni desactivar a un super_admin.
  private assertPuedeGestionar(rolObjetivo: RolUsuario, actorRol: RolUsuario) {
    const reservados: RolUsuario[] = [RolUsuario.super_admin, RolUsuario.analista_sutl];
    if (reservados.includes(rolObjetivo) && actorRol !== RolUsuario.super_admin) {
      throw new ForbiddenException('No tienes permiso para gestionar este usuario');
    }
  }

  private readonly publicSelect = {
    id: true,
    email: true,
    nombre: true,
    rol: true,
    partnerId: true,
    activo: true,
    tenantId: true,
    createdAt: true,
    updatedAt: true,
  };
}
