import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { EXTERNO_KEY } from '../decorators/externo.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const destinos = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(ROLES_KEY, destinos);
    const { user }: { user: RequestUser } = context.switchToHttp().getRequest();

    // Proveedor (usuario externo): acceso denegado por defecto. Solo entra donde
    // se le nombra en @Roles o la ruta está marcada con @Externo().
    if (user?.rol === RolUsuario.proveedor) {
      if (requiredRoles && requiredRoles.length > 0) return requiredRoles.includes(RolUsuario.proveedor);
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
