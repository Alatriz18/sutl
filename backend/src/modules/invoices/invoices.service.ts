import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: { partner: true, pagos: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { partner: true, pagos: true, shipment: true },
    });
    if (!invoice) {
      throw new NotFoundException('Factura no encontrada');
    }
    return invoice;
  }

  async create(tenantId: string, dto: CreateInvoiceDto) {
    const prefijo = dto.tipo === 'cxc' ? 'FAC-CXC' : 'FAC-CXP';
    const numero = await this.generarNumero(prefijo);
    return this.prisma.invoice.create({
      data: { ...dto, tenantId, numero },
      include: { partner: true },
    });
  }

  // Registra un pago contra la factura; si la suma de pagos alcanza el
  // monto total, la factura pasa automáticamente a `pagada`.
  async registrarPago(tenantId: string, invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.findOne(tenantId, invoiceId);

    const pago = await this.prisma.payment.create({
      data: { ...dto, tenantId, invoiceId },
    });

    const totalPagado =
      invoice.pagos.reduce((acc, p) => acc + p.monto, 0) + dto.monto;

    if (totalPagado >= invoice.montoTotal) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { estado: 'pagada' },
      });
    }

    return pago;
  }

  private async generarNumero(prefijo: string): Promise<string> {
    let numero: string;
    let existe = true;
    do {
      numero = `${prefijo}-${randomBytes(3).toString('hex').toUpperCase()}`;
      existe = (await this.prisma.invoice.count({ where: { numero } })) > 0;
    } while (existe);
    return numero;
  }
}
