import { BadRequestException, ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sha256 } from '../../common/crypto';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService, FORMATO_API_KEY } from './api-keys.service';

describe('ApiKeysService', () => {
  const prisma = { apiKey: { count: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() } };
  const service = new ApiKeysService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.apiKey.count.mockResolvedValue(0);
    prisma.apiKey.create.mockImplementation(({ data }) => Promise.resolve({ id: 'k1', nombre: data.nombre, prefijo: data.prefijo }));
  });

  it('genera una llave con el formato esperado y guarda solo su huella', async () => {
    const r = await service.crear('t1', 'u1', '  ERP  ');
    expect(r.llave).toMatch(FORMATO_API_KEY);
    const data = prisma.apiKey.create.mock.calls[0][0].data;
    expect(data.hash).toBe(sha256(r.llave));
    expect(data.prefijo).toBe(r.llave.slice(0, 11));
    expect(data.nombre).toBe('ERP');
    expect(JSON.stringify(data)).not.toContain(r.llave);
  });

  it('dos llaves nunca coinciden', async () => {
    const [a, b] = await Promise.all([service.crear('t1', null, 'a'), service.crear('t1', null, 'b')]);
    expect(a.llave).not.toBe(b.llave);
  });

  it('no deja pasar de 20 claves activas', async () => {
    prisma.apiKey.count.mockResolvedValue(20);
    await expect(service.crear('t1', null, 'x')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.apiKey.create).not.toHaveBeenCalled();
    expect(prisma.apiKey.count).toHaveBeenCalledWith({ where: { tenantId: 't1', revocadaAt: null } });
  });

  it('revocar filtra por empresa y solo toca las no revocadas', async () => {
    prisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
    await service.revocar('t1', 'k1');
    expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({ where: { id: 'k1', tenantId: 't1', revocadaAt: null }, data: { revocadaAt: expect.any(Date) } });
  });

  it('revocar una llave ajena o ya revocada da 404', async () => {
    prisma.apiKey.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revocar('t1', 'k1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listar nunca selecciona el hash', async () => {
    prisma.apiKey.findMany.mockResolvedValue([]);
    await service.listar('t1');
    const arg = prisma.apiKey.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: 't1' });
    expect(arg.select).not.toHaveProperty('hash');
  });
});

describe('ApiKeyGuard', () => {
  const prisma = { apiKey: { findUnique: jest.fn(), updateMany: jest.fn() } };
  const guard = new ApiKeyGuard(prisma as never);
  const llave = `sutl_${'a'.repeat(32)}`;
  const ctx = (headers: Record<string, unknown>) => {
    const req: Record<string, unknown> = { headers };
    return { req, contexto: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext };
  };
  const registro = (extra: Record<string, unknown> = {}) => ({
    id: 'k1', tenantId: 't1', revocadaAt: null, ultimoUsoAt: new Date(), tenant: { activo: true }, ...extra,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
  });

  it.each([[undefined], [''], ['basura'], [`sutl_${'a'.repeat(31)}`], [`sutl_${'a'.repeat(33)}`], [`xxxx_${'a'.repeat(32)}`], [['a', 'b']], [123]])(
    'rechaza una cabecera inválida (%p) sin consultar la base',
    async (valor) => {
      await expect(guard.canActivate(ctx({ 'x-api-key': valor }).contexto)).rejects.toThrow(new UnauthorizedException('API key inválida'));
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
    },
  );

  it('busca por la huella (nunca por la llave en claro)', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(registro());
    await guard.canActivate(ctx({ 'x-api-key': llave }).contexto);
    expect(prisma.apiKey.findUnique.mock.calls[0][0].where).toEqual({ hash: sha256(llave) });
  });

  it('acepta una llave vigente y deja el tenantId de la clave en la petición', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(registro());
    const { req, contexto } = ctx({ 'x-api-key': llave });
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    expect(req.apiTenantId).toBe('t1');
  });

  it.each([
    ['inexistente', null],
    ['revocada', registro({ revocadaAt: new Date() })],
    ['de empresa inactiva', registro({ tenant: { activo: false } })],
  ])('rechaza una llave %s con el mismo mensaje', async (_n, fila) => {
    prisma.apiKey.findUnique.mockResolvedValue(fila);
    const { req, contexto } = ctx({ 'x-api-key': llave });
    await expect(guard.canActivate(contexto)).rejects.toThrow(new UnauthorizedException('API key inválida'));
    expect(req.apiTenantId).toBeUndefined();
  });

  it('actualiza el último uso solo si pasó más de un minuto', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(registro({ ultimoUsoAt: new Date() }));
    await guard.canActivate(ctx({ 'x-api-key': llave }).contexto);
    expect(prisma.apiKey.updateMany).not.toHaveBeenCalled();

    prisma.apiKey.findUnique.mockResolvedValue(registro({ ultimoUsoAt: new Date(Date.now() - 120_000) }));
    await guard.canActivate(ctx({ 'x-api-key': llave }).contexto);
    expect(prisma.apiKey.updateMany).toHaveBeenCalledTimes(1);
  });

  it('un fallo al marcar el último uso no tumba la petición', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(registro({ ultimoUsoAt: null }));
    prisma.apiKey.updateMany.mockRejectedValue(new Error('db caída'));
    await expect(guard.canActivate(ctx({ 'x-api-key': llave }).contexto)).resolves.toBe(true);
  });
});
