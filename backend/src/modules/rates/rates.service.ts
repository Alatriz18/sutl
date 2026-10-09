import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRateDto } from './dto/create-rate.dto';
import { UpdateRateDto } from './dto/update-rate.dto';

// Una tarifa puede ser global (tenantId null, tarifa pública de mercado) o
// negociada por un tenant específico. findAll devuelve ambas para que el
// tenant vea su propia lista de referencia de costos.
@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.rate.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      include: { carrier: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const rate = await this.prisma.rate.findFirst({
      where: { id, OR: [{ tenantId }, { tenantId: null }] },
      include: { carrier: true },
    });
    if (!rate) {
      throw new NotFoundException('Tarifa no encontrada');
    }
    return rate;
  }

  create(tenantId: string, dto: CreateRateDto) {
    return this.prisma.rate.create({
      data: { ...dto, tenantId },
      include: { carrier: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateRateDto) {
    await this.findOne(tenantId, id);
    return this.prisma.rate.update({
      where: { id },
      data: dto,
      include: { carrier: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.rate.update({ where: { id }, data: { activo: false } });
  }
}
