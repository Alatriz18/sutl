import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Todo método recibe tenantId explícitamente y filtra por él: ningún query
// de este servicio puede cruzar datos entre tenants (ver CLAUDE.md).
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(tenantId: string, dto: CreateUserDto) {
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
    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.publicSelect,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.user.update({
      where: { id },
      data: { activo: false },
      select: this.publicSelect,
    });
  }

  private readonly publicSelect = {
    id: true,
    email: true,
    nombre: true,
    rol: true,
    activo: true,
    tenantId: true,
    createdAt: true,
    updatedAt: true,
  };
}
