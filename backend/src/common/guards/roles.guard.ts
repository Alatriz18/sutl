import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { EXTERNO_KEY } from '../decorators/externo.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../interfaces/jwt-payload.interface';

const ROLES_EXTERNOS: RolUsuario[] = [RolUsuario.proveedor, RolUsuario.cliente_final];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const destinos = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, destinos);
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();

    // Usuarios externos (proveedor y cliente final): acceso denegado por defecto. Solo
    // entran donde se les nombra en @Roles o la ruta está marcada con @Externo().
    if (user && ROLES_EXTERNOS.includes(user.rol)) {
      if (requiredRoles && requiredRoles.length > 0) return requiredRoles.includes(user.rol);
      return this.reflector.getAllAndOverride<boolean>(EXTERNO_KEY, destinos) === true;
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // El analista de SUTL cuenta como operador (nunca como administrador): lo que
    // puede hacer en cada empresa lo limita además su permiso (ver AnalystAccessGuard).
    const efectivo = user?.rol === RolUsuario.analista_sutl ? RolUsuario.operador : user?.rol;
    return requiredRoles.includes(user?.rol) || requiredRoles.includes(efectivo);
  }
}
