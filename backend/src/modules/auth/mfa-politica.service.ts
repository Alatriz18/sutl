import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RolUsuario } from '@prisma/client';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { TenantConfigService } from '../tenant-config/tenant-config.service';

// Quién debe tener segundo factor. Función pura para poder probarla sin base de datos.
export function mfaExigido(rol: RolUsuario, politica: { administradoresDeLaEmpresa: boolean; personalSutl: boolean }): boolean {
  if (rol === RolUsuario.admin_tenant) return politica.administradoresDeLaEmpresa;
  if (rol === RolUsuario.analista_sutl || rol === RolUsuario.super_admin) return politica.personalSutl;
  return false;
}

// · Administradores de una empresa: lo decide cada empresa en su configuración (seguridad.exigirMfaAdministradores).
// · Personal de SUTL (analistas y super administradores): siempre en producción; fuera de producción solo si
//   MFA_OBLIGATORIO_PERSONAL_SUTL=true, para no estorbar el desarrollo local.
@Injectable()
export class MfaPoliticaService {
  constructor(
    private readonly tenantConfig: TenantConfigService,
    private readonly config: ConfigService,
  ) {}

  personalSutlObligatorio(): boolean {
    const v = this.config.get<string>('MFA_OBLIGATORIO_PERSONAL_SUTL');
    if (v === 'true') return true;
    if (v === 'false') return false;
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  async exigido(user: Pick<RequestUser, 'tenantId' | 'rol'>): Promise<boolean> {
    const personalSutl = this.personalSutlObligatorio();
    // Solo el administrador de empresa necesita leer la configuración.
    const administradoresDeLaEmpresa =
      user.rol === RolUsuario.admin_tenant ? (await this.tenantConfig.getEfectiva(user.tenantId)).seguridad.exigirMfaAdministradores : false;
    return mfaExigido(user.rol, { administradoresDeLaEmpresa, personalSutl });
  }
}
