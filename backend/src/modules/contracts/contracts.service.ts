import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.contract.findMany({
      where: { tenantId },
      include: { carrier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, tenantId },
      include: { carrier: true },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }
    return contract;
  }

  create(tenantId: string, dto: CreateContractDto) {
    return this.prisma.contract.create({
      data: { ...dto, tenantId, condiciones: dto.condiciones as Prisma.InputJsonValue },
      include: { carrier: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateContractDto) {
    await this.findOne(tenantId, id);
    return this.prisma.contract.update({
      where: { id },
      data: { ...dto, condiciones: dto.condiciones as Prisma.InputJsonValue },
      include: { carrier: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.contract.update({ where: { id }, data: { activo: false } });
  }
}
