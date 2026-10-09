import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Shipment } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

const DIA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.alert.findMany({
      where: { tenantId },
      include: { shipment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const alert = await this.prisma.alert.findFirst({ where: { id, tenantId } });
    if (!alert) {
      throw new NotFoundException('Alerta no encontrada');
    }
    return alert;
  }

  create(tenantId: string, dto: CreateAlertDto) {
    return this.prisma.alert.create({
      data: { ...dto, tenantId, condicion: dto.condicion as Prisma.InputJsonValue },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAlertDto) {
    await this.findOne(tenantId, id);
    return this.prisma.alert.update({
      where: { id },
      data: { ...dto, condicion: dto.condicion as Prisma.InputJsonValue | undefined },
    });
  }

  // Evalúa las reglas activas del tenant contra sus envíos actuales y
  // devuelve, por cada alerta, los envíos que la disparan ahora mismo.
  // No hay cron todavía: se evalúa "en caliente" cada vez que se consulta.
  async evaluar(tenantId: string) {
    const [alertasActivas, shipments, documentos] = await Promise.all([
      this.prisma.alert.findMany({ where: { tenantId, activo: true } }),
      this.prisma.shipment.findMany({ where: { tenantId } }),
      this.prisma.document.findMany({ where: { tenantId } }),
    ]);

    const ahora = Date.now();

    return alertasActivas.map((alerta) => {
      const condicion = (alerta.condicion ?? {}) as Record<string, unknown>;
      let disparados: Shipment[] = [];

      const universo = alerta.shipmentId
        ? shipments.filter((s) => s.id === alerta.shipmentId)
        : shipments;

      if (alerta.tipo === 'retraso') {
        const estado = condicion.estado as string | undefined;
        const diasUmbral = Number(condicion.diasUmbral ?? 0);
        disparados = universo.filter(
          (s) => s.estado === estado && ahora - new Date(s.updatedAt).getTime() >= diasUmbral * DIA_MS,
        );
      } else if (alerta.tipo === 'documento_faltante') {
        const tipoDocumento = condicion.tipoDocumento as string | undefined;
        const diasUmbral = Number(condicion.diasUmbral ?? 0);
        disparados = universo.filter((s) => {
          const suficienteAntiguedad = ahora - new Date(s.createdAt).getTime() >= diasUmbral * DIA_MS;
          const tieneDocumento = documentos.some(
            (d) => d.shipmentId === s.id && d.tipo === tipoDocumento,
          );
          return suficienteAntiguedad && !tieneDocumento && s.estado !== 'entregado';
        });
      } else if (alerta.tipo === 'llegada_proxima') {
        const diasAntes = Number(condicion.diasAntes ?? 0);
        disparados = universo.filter((s) => {
          if (!s.fechaEstimadaLlegada || s.estado === 'entregado') return false;
          const restante = new Date(s.fechaEstimadaLlegada).getTime() - ahora;
          return restante >= 0 && restante <= diasAntes * DIA_MS;
        });
      }

      return { alerta, disparados };
    });
  }
}
