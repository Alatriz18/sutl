import { Injectable, NotFoundException } from '@nestjs/common';
import { TipoPartner } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string, tipo?: TipoPartner) {
    return this.prisma.partner.findMany({
      where: { tenantId, ...(tipo ? { tipo } : {}) },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const partner = await this.prisma.partner.findFirst({ where: { id, tenantId } });
    if (!partner) {
      throw new NotFoundException('Contacto no encontrado');
    }
    return partner;
  }

  create(tenantId: string, dto: CreatePartnerDto) {
    return this.prisma.partner.create({ data: { ...dto, tenantId } });
  }

  async update(tenantId: string, id: string, dto: UpdatePartnerDto) {
    await this.findOne(tenantId, id);
    return this.prisma.partner.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.partner.update({ where: { id }, data: { activo: false } });
  }
}
