import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RegistroBitacora {
  tenantId: string;
  userId?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  metadata?: Record<string, unknown>;
}

// Bitácora: quién hizo qué y cuándo. Solo se agrega (no hay editar ni borrar).
// Registrar nunca rompe la operación de negocio: si falla, se deja en el log.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(r: RegistroBitacora): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: r.tenantId,
          userId: r.userId ?? null,
          accion: r.accion,
          entidad: r.entidad,
          entidadId: r.entidadId ?? null,
          metadata: (r.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.error(`No se pudo registrar en la bitácora (${r.accion}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  listar(tenantId: string, filtros: { entidad?: string; entidadId?: string; limite?: number }) {
    const limite = Math.min(Math.max(filtros.limite ?? 100, 1), 500);
    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(filtros.entidad ? { entidad: filtros.entidad } : {}),
        ...(filtros.entidadId ? { entidadId: filtros.entidadId } : {}),
      },
      include: { user: { select: { id: true, nombre: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limite,
    });
  }
}
