import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.report.findMany({
      where: { tenantId },
      include: { generadoPor: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const report = await this.prisma.report.findFirst({ where: { id, tenantId } });
    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return report;
  }

  async create(tenantId: string, userId: string, dto: CreateReportDto) {
    const urlArchivo =
      dto.formato === 'csv' ? await this.generarCsv(tenantId, dto.tipo) : null;

    return this.prisma.report.create({
      data: { ...dto, tenantId, urlArchivo, generadoPorId: userId },
      include: { generadoPor: true },
    });
  }

  // Solo CSV se genera de verdad por ahora (reutiliza el mismo storage local
  // que documents). PDF/Excel quedan con el registro creado pero sin archivo
  // hasta conectar un generador real.
  private async generarCsv(tenantId: string, tipo: string): Promise<string> {
    const shipments = await this.prisma.shipment.findMany({
      where: { tenantId },
      include: { carrier: true },
    });

    let filas: string[];
    if (tipo === 'envios_por_naviera') {
      const porNaviera = new Map<string, number>();
      for (const s of shipments) {
        const nombre = s.carrier?.nombre ?? 'Sin asignar';
        porNaviera.set(nombre, (porNaviera.get(nombre) ?? 0) + 1);
      }
      filas = ['naviera,cantidad', ...[...porNaviera.entries()].map(([n, c]) => `${n},${c}`)];
    } else if (tipo === 'envios_por_cliente') {
      const porCliente = new Map<string, number>();
      for (const s of shipments) {
        porCliente.set(s.destinatarioNombre, (porCliente.get(s.destinatarioNombre) ?? 0) + 1);
      }
      filas = ['cliente,cantidad', ...[...porCliente.entries()].map(([n, c]) => `${n},${c}`)];
    } else {
      // envios_por_estado (default)
      const porEstado = new Map<string, number>();
      for (const s of shipments) {
        porEstado.set(s.estado, (porEstado.get(s.estado) ?? 0) + 1);
      }
      filas = ['estado,cantidad', ...[...porEstado.entries()].map(([n, c]) => `${n},${c}`)];
    }

    const dir = `uploads/${tenantId}/reports`;
    mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}.csv`;
    writeFileSync(`${dir}/${filename}`, filas.join('\n'), 'utf-8');

    return `/uploads/${tenantId}/reports/${filename}`;
  }
}
