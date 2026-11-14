import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AnalystAccessGuard } from './analyst-access.guard';

function montar(user: Record<string, unknown> | undefined, req: { method?: string; url?: string } = {}) {
  const access = { accesoVigente: jest.fn() };
  const guard = new AnalystAccessGuard(access as never);
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user, method: req.method ?? 'GET', originalUrl: req.url ?? '/api/shipments' }) }),
  } as unknown as ExecutionContext;
  return { guard, ctx, access };
}

const analista = (extra: Record<string, unknown> = {}) => ({ userId: 'a1', rol: 'analista_sutl', tenantId: 'cliente', origen: 'sutl', ...extra });

describe('AnalystAccessGuard', () => {
  it('no toca a quien no es analista (ni consulta la base)', async () => {
    const { guard, ctx, access } = montar({ userId: 'u', rol: 'operador', tenantId: 't1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(access.accesoVigente).not.toHaveBeenCalled();
  });

  it('las rutas públicas (sin usuario) pasan', async () => {
    const { guard, ctx } = montar(undefined);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('un token de analista sin empresa de origen no es válido', async () => {
    const { guard, ctx } = montar(analista({ origen: undefined }));
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('en su propia empresa no necesita permiso', async () => {
    const { guard, ctx, access } = montar(analista({ tenantId: 'sutl' }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(access.accesoVigente).not.toHaveBeenCalled();
  });

  it('en una empresa cliente exige el permiso vigente en cada request', async () => {
    const { guard, ctx, access } = montar(analista());
    access.accesoVigente.mockResolvedValue(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow('no está vigente');
    expect(access.accesoVigente).toHaveBeenCalledWith('a1', 'cliente');
  });

  it('con permiso de solo lectura deja leer pero no escribir', async () => {
    const lectura = montar(analista(), { method: 'GET' });
    lectura.access.accesoVigente.mockResolvedValue({ id: 'g1', soloLectura: true });
    await expect(lectura.guard.canActivate(lectura.ctx)).resolves.toBe(true);

    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      const escritura = montar(analista(), { method });
      escritura.access.accesoVigente.mockResolvedValue({ id: 'g1', soloLectura: true });
      await expect(escritura.guard.canActivate(escritura.ctx)).rejects.toThrow('solo lectura');
    }
  });

  it('con permiso de gestión también puede escribir', async () => {
    const { guard, ctx, access } = montar(analista(), { method: 'POST' });
    access.accesoVigente.mockResolvedValue({ id: 'g1', soloLectura: false });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('las rutas de la cuenta (/auth) funcionan aunque el permiso se haya revocado', async () => {
    const { guard, ctx, access } = montar(analista(), { method: 'POST', url: '/api/auth/empresa-activa' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(access.accesoVigente).not.toHaveBeenCalled();
  });
});
