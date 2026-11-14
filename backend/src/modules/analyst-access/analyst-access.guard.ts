import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { Request } from 'express';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { AnalystAccessService } from './analyst-access.service';

const METODOS_DE_LECTURA = ['GET', 'HEAD', 'OPTIONS'];

// Guard global (corre después de la autenticación). Solo actúa sobre el analista
// de SUTL que trabaja en una empresa que no es la suya: exige que el permiso siga
// vigente en cada request y, si es de solo lectura, bloquea cualquier escritura.
@Injectable()
export class AnalystAccessGuard implements CanActivate {
  constructor(private readonly access: AnalystAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = req.user;
    if (!user || user.rol !== RolUsuario.analista_sutl) return true;

    // Un token de analista siempre trae su empresa de origen; sin ella no es nuestro.
    if (!user.origen) throw new ForbiddenException('Sesión no válida');
    if (user.tenantId === user.origen) return true;

    // Cerrar sesión, renovarla y cambiar de empresa son de la cuenta, no de la empresa:
    // deben funcionar aunque el permiso se haya revocado (así puede volver a la suya).
    const ruta = (req.originalUrl ?? req.url ?? '').split('?')[0];
    if (/\/auth\//.test(ruta)) return true;

    const grant = await this.access.accesoVigente(user.userId, user.tenantId);
    if (!grant) throw new ForbiddenException('Tu acceso a esta empresa no está vigente');

    if (grant.soloLectura && !METODOS_DE_LECTURA.includes(req.method)) {
      throw new ForbiddenException('Tu acceso a esta empresa es de solo lectura');
    }
    return true;
  }
}
