import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import {
  AjustesOperacion,
  ConfigOperacion,
  PERFILES,
  PERFIL_IDS,
  PERFIL_POR_DEFECTO,
  combinarAjustes,
  esPerfilValido,
  resolverConfig,
  sanitizarAjustes,
} from './tenant-config.defaults';

@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const tenant = await this.leer(tenantId);
    return this.respuesta(tenant.perfilOperacion, tenant.configuracion);
  }

  // Lo que usan los demás módulos para aplicar las reglas del tenant.
  async getEfectiva(tenantId: string): Promise<ConfigOperacion> {
    const tenant = await this.leer(tenantId);
    return resolverConfig(tenant.perfilOperacion, tenant.configuracion);
  }

  async update(tenantId: string, dto: UpdateTenantConfigDto, actorUserId?: string) {
    const tenant = await this.leer(tenantId);
    const cambiaPerfil = dto.perfil !== undefined && dto.perfil !== tenant.perfilOperacion;
    const base: AjustesOperacion =
      cambiaPerfil || dto.restablecer ? {} : sanitizarAjustes(tenant.configuracion);
    const ajustes = combinarAjustes(base, (dto.configuracion ?? {}) as AjustesOperacion);
    const perfil = dto.perfil ?? tenant.perfilOperacion;

    // El umbral de atención no puede quedar por encima de la meta (se compara ya con los valores efectivos).
    const { analitica } = resolverConfig(perfil, ajustes);
    if (analitica.umbralAtencionOtifPct > analitica.metaOtifPct) {
      throw new BadRequestException('El umbral de atención del OTIF no puede ser mayor que la meta');
    }

    // Cada responsable de excepciones debe ser un usuario INTERNO, activo y de esta empresa (nunca de otra ni externo).
    const ex = resolverConfig(perfil, ajustes).excepciones;
    const ids = [ex.responsableSkuRojoId, ex.responsableOcAtrasadaId, ex.responsableDocumentoFaltanteId].filter(Boolean);
    if (ids.length > 0) {
      const validos = await this.prisma.user.count({ where: { id: { in: [...new Set(ids)] }, tenantId, activo: true, rol: { in: ['admin_tenant', 'operador', 'analista_sutl'] } } });
      if (validos !== new Set(ids).size) throw new BadRequestException('El responsable de excepciones debe ser un usuario interno y activo de tu empresa');
    }

    // Para no dejar a la empresa sin acceso: quien exige el segundo factor debe tenerlo activo él mismo antes.
    const exigeAhora = resolverConfig(perfil, ajustes).seguridad.exigirMfaAdministradores;
    const exigiaAntes = resolverConfig(tenant.perfilOperacion, tenant.configuracion).seguridad.exigirMfaAdministradores;
    if (exigeAhora && !exigiaAntes && actorUserId) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { mfaEnabledAt: true } });
      if (!actor?.mfaEnabledAt) {
        throw new BadRequestException('Activa primero tu propio segundo factor (en Seguridad de la cuenta) antes de exigirlo a los administradores');
      }
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { perfilOperacion: perfil, configuracion: ajustes as Prisma.InputJsonValue },
    });
    return this.respuesta(perfil, ajustes);
  }

  private async leer(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { perfilOperacion: true, configuracion: true },
    });
    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada');
    }
    return tenant;
  }

  private respuesta(perfil: string, ajustes: unknown) {
    return {
      perfil: esPerfilValido(perfil) ? perfil : PERFIL_POR_DEFECTO,
      configuracion: resolverConfig(perfil, ajustes),
      // Qué valores cambió el tenant respecto del perfil (para marcarlos en la UI).
      ajustes: sanitizarAjustes(ajustes),
      perfiles: PERFIL_IDS.map((id) => ({
        id,
        nombre: PERFILES[id].nombre,
        descripcion: PERFILES[id].descripcion,
        config: PERFILES[id].config,
      })),
    };
  }
}
