import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import { EXTERNO_KEY } from '../decorators/externo.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function contexto(rol: RolUsuario | undefined, metadata: { roles?: RolUsuario[]; externo?: boolean }) {
  const reflector = {
    getAllAndOverride: (key: string) => (key === ROLES_KEY ? metadata.roles : key === EXTERNO_KEY ? metadata.externo : undefined),
  } as unknown as Reflector;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: rol ? { rol } : undefined }) }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(reflector), ctx };
}

describe('RolesGuard', () => {
  it('sin @Roles deja pasar a cualquier usuario interno', () => {
    for (const rol of ['super_admin', 'admin_tenant', 'operador', 'cliente_final', 'analista_sutl'] as RolUsuario[]) {
      const { guard, ctx } = contexto(rol, {});
      expect(guard.canActivate(ctx)).toBe(true);
    }
  });

  it('respeta @Roles para los roles de siempre', () => {
    const roles = ['admin_tenant', 'super_admin'] as RolUsuario[];
    expect(contexto('admin_tenant', { roles }).guard.canActivate(contexto('admin_tenant', { roles }).ctx)).toBe(true);
    const { guard, ctx } = contexto('operador', { roles });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  describe('analista_sutl', () => {
    it('cuenta como operador, nunca como administrador', () => {
      const operador = contexto('analista_sutl', { roles: ['operador'] });
      expect(operador.guard.canActivate(operador.ctx)).toBe(true);
      const admin = contexto('analista_sutl', { roles: ['admin_tenant', 'super_admin'] });
      expect(admin.guard.canActivate(admin.ctx)).toBe(false);
    });

    it('puede usar las rutas que lo nombran a él', () => {
      const { guard, ctx } = contexto('analista_sutl', { roles: ['analista_sutl'] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('no entra a rutas solo de super_admin', () => {
      const { guard, ctx } = contexto('analista_sutl', { roles: ['super_admin'] });
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });

  describe('proveedor (acceso denegado por defecto)', () => {
    it('no entra a una ruta sin @Roles ni @Externo', () => {
      const { guard, ctx } = contexto('proveedor', {});
      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('no entra a una ruta con @Roles que no lo nombra', () => {
      const { guard, ctx } = contexto('proveedor', { roles: ['admin_tenant', 'operador', 'super_admin'] });
      expect(guard.canActivate(ctx)).toBe(false);
    });

    it('entra donde @Roles lo nombra', () => {
      const { guard, ctx } = contexto('proveedor', { roles: ['operador', 'proveedor'] });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('entra a las rutas marcadas @Externo (su cuenta), salvo que @Roles las restrinja', () => {
      const abierta = contexto('proveedor', { externo: true });
      expect(abierta.guard.canActivate(abierta.ctx)).toBe(true);
      const restringida = contexto('proveedor', { externo: true, roles: ['admin_tenant'] });
      expect(restringida.guard.canActivate(restringida.ctx)).toBe(false);
    });
  });
});
