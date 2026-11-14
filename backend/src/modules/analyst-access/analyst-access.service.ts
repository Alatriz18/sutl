import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GrantAnalystDto } from './dto/grant-analyst.dto';

// Acceso explícito de un analista de SUTL a una empresa cliente. Solo un
// super_admin lo otorga o lo revoca; cada cambio queda en la bitácora de la
// empresa afectada para que ella pueda ver quién de SUTL tuvo acceso.
@Injectable()
export class AnalystAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // El permiso vigente de un analista sobre una empresa, o null. Se consulta en
  // CADA request del analista fuera de su empresa: revocar surte efecto al instante.
  accesoVigente(analystId: string, tenantId: string) {
    return this.prisma.analystGrant.findFirst({
      where: {
        analystId,
        tenantId,
        activo: true,
        analyst: { activo: true, rol: 'analista_sutl' },
        tenant: { activo: true },
      },
      select: { id: true, soloLectura: true },
    });
  }

  // Empresas en las que el analista puede trabajar (además de la suya).
  empresasDe(analystId: string) {
    return this.prisma.analystGrant.findMany({
      where: { analystId, activo: true, tenant: { activo: true } },
      select: { soloLectura: true, tenant: { select: { id: true, nombre: true } } },
      orderBy: { tenant: { nombre: 'asc' } },
    });
  }

  listar(filtros: { analystId?: string; tenantId?: string }) {
    return this.prisma.analystGrant.findMany({
      where: { ...(filtros.analystId ? { analystId: filtros.analystId } : {}), ...(filtros.tenantId ? { tenantId: filtros.tenantId } : {}) },
      include: {
        analyst: { select: { id: true, nombre: true, email: true } },
        tenant: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async otorgar(actorId: string, dto: GrantAnalystDto) {
    const analista = await this.prisma.user.findFirst({ where: { id: dto.analystId, rol: 'analista_sutl', activo: true } });
    if (!analista) throw new NotFoundException('Analista no encontrado');
    if (analista.tenantId === dto.tenantId) {
      throw new BadRequestException('El analista ya pertenece a esa empresa: no necesita un permiso');
    }
    const empresa = await this.prisma.tenant.findFirst({ where: { id: dto.tenantId, activo: true } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    const soloLectura = dto.soloLectura ?? true;
    // Reactivar un permiso revocado reutiliza la misma fila (único por analista y empresa).
    const grant = await this.prisma.analystGrant.upsert({
      where: { analystId_tenantId: { analystId: dto.analystId, tenantId: dto.tenantId } },
      create: { analystId: dto.analystId, tenantId: dto.tenantId, soloLectura, otorgadoPorId: actorId },
      update: { activo: true, revocadoAt: null, soloLectura, otorgadoPorId: actorId },
    });
    await this.audit.registrar({
      tenantId: dto.tenantId,
      userId: actorId,
      accion: 'analista.acceso_otorgado',
      entidad: 'usuario',
      entidadId: dto.analystId,
      metadata: { analista: analista.email, soloLectura },
    });
    return grant;
  }

  async revocar(actorId: string, id: string) {
    const grant = await this.prisma.analystGrant.findUnique({ where: { id }, include: { analyst: { select: { email: true } } } });
    if (!grant) throw new NotFoundException('Permiso no encontrado');
    // Condicional: revocar dos veces no repite la bitácora.
    const { count } = await this.prisma.analystGrant.updateMany({ where: { id, activo: true }, data: { activo: false, revocadoAt: new Date() } });
    if (count > 0) {
      // Si justo estaba trabajando en esa empresa, vuelve a la suya.
      await this.prisma.user.updateMany({ where: { id: grant.analystId, empresaActivaId: grant.tenantId }, data: { empresaActivaId: null } });
      await this.audit.registrar({
        tenantId: grant.tenantId,
        userId: actorId,
        accion: 'analista.acceso_revocado',
        entidad: 'usuario',
        entidadId: grant.analystId,
        metadata: { analista: grant.analyst.email },
      });
    }
    return { ok: true };
  }
}
