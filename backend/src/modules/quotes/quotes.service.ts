import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.quote.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { cliente: true, carrier: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, tenantId },
      include: { cliente: true, carrier: true, bookings: true },
    });
    if (!quote) {
      throw new NotFoundException('Cotización no encontrada');
    }
    return quote;
  }

  async create(tenantId: string, userId: string, dto: CreateQuoteDto) {
    const numero = await this.generarNumero();
    return this.prisma.quote.create({
      data: { ...dto, tenantId, numero, creadoPorId: userId },
      include: { cliente: true, carrier: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateQuoteDto) {
    await this.findOne(tenantId, id);
    return this.prisma.quote.update({
      where: { id },
      data: dto,
      include: { cliente: true, carrier: true },
    });
  }

  private async generarNumero(): Promise<string> {
    let numero: string;
    let existe = true;
    do {
      numero = `COT-${randomBytes(4).toString('hex').toUpperCase()}`;
      existe = (await this.prisma.quote.count({ where: { numero } })) > 0;
    } while (existe);
    return numero;
  }
}
