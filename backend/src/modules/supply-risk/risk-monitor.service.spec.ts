import { Prisma } from '@prisma/client';
import { RiskMonitorService } from './risk-monitor.service';

type Mock = jest.Mock;

describe('RiskMonitorService', () => {
  let prisma: {
    riskState: { findMany: Mock; create: Mock; updateMany: Mock };
    riskChange: { create: Mock; findMany: Mock; updateMany: Mock };
    user: { findMany: Mock };
    tenant: { findMany: Mock };
  };
  let risk: { evaluar: Mock };
  let config: { getEfectiva: Mock };
  let notifications: { create: Mock };
  let webhooks: { emitir: Mock };
  let service: RiskMonitorService;

  const fila = (sku: string, semaforo: string, extra: Record<string, unknown> = {}) => ({
    sku, semaforo, accion: semaforo === 'rojo' ? 'compra_urgente' : 'ninguna', motivo: `motivo ${sku}`, fechaQuiebre: null, ...extra,
  });
  const estado = (sku: string, semaforo: string) => ({ sku, semaforo, tenantId: 't1' });

  beforeEach(() => {
    prisma = {
      riskState: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      riskChange: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', email: 'admin@empresa.com' }]) },
      tenant: { findMany: jest.fn() },
    };
    risk = { evaluar: jest.fn() };
    config = { getEfectiva: jest.fn().mockResolvedValue({ riesgo: { avisarAlPasarARojo: true } }) };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    webhooks = { emitir: jest.fn().mockResolvedValue(undefined) };
    service = new RiskMonitorService(prisma as never, risk as never, config as never, notifications as never, webhooks as never);
  });

  const evaluar = (filas: ReturnType<typeof fila>[]) => {
    risk.evaluar.mockResolvedValue({ filas });
    return service.evaluarEmpresa('t1');
  };

  it('la primera vez registra el estado de cada SKU y un cambio "desde null"', async () => {
    const c = await evaluar([fila('A', 'verde'), fila('B', 'rojo')]);
    expect(c.map((x) => [x.sku, x.desde, x.hacia])).toEqual([['A', null, 'verde'], ['B', null, 'rojo']]);
    expect(prisma.riskState.create).toHaveBeenCalledTimes(2);
    expect(prisma.riskChange.create).toHaveBeenCalledTimes(2);
  });

  it('si el semáforo no cambió no escribe nada ni avisa', async () => {
    prisma.riskState.findMany.mockResolvedValue([estado('A', 'verde')]);
    expect(await evaluar([fila('A', 'verde')])).toEqual([]);
    expect(prisma.riskChange.create).not.toHaveBeenCalled();
    expect(webhooks.emitir).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('todo se lee y escribe con el tenant de la evaluación', async () => {
    prisma.riskState.findMany.mockResolvedValue([estado('A', 'verde')]);
    await evaluar([fila('A', 'rojo')]);
    expect(prisma.riskState.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
    expect(prisma.riskState.updateMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', sku: 'A', semaforo: 'verde' });
    expect(prisma.riskChange.create.mock.calls[0][0].data.tenantId).toBe('t1');
  });

  it('el cambio es condicional: si otra evaluación ya lo registró, no se duplica', async () => {
    prisma.riskState.findMany.mockResolvedValue([estado('A', 'verde')]);
    prisma.riskState.updateMany.mockResolvedValue({ count: 0 });
    expect(await evaluar([fila('A', 'rojo')])).toEqual([]);
    expect(prisma.riskChange.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('si dos evaluaciones crean el mismo SKU a la vez (unique), la perdedora lo ignora', async () => {
    prisma.riskState.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    expect(await evaluar([fila('A', 'rojo')])).toEqual([]);
    expect(prisma.riskChange.create).not.toHaveBeenCalled();
  });

  it('otros errores de base sí se propagan', async () => {
    prisma.riskState.create.mockRejectedValue(new Error('db caída'));
    await expect(evaluar([fila('A', 'rojo')])).rejects.toThrow('db caída');
  });

  it('cada cambio se publica a los webhooks de la empresa', async () => {
    prisma.riskState.findMany.mockResolvedValue([estado('A', 'verde')]);
    await evaluar([fila('A', 'rojo')]);
    expect(webhooks.emitir).toHaveBeenCalledWith('t1', 'riesgo.semaforo_cambiado', expect.objectContaining({ sku: 'A', desde: 'verde', hacia: 'rojo', accion: 'compra_urgente' }));
  });

  describe('aviso por correo al pasar a rojo', () => {
    it('manda UN solo correo con todos los SKU que pasaron a rojo, a cada administrador', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'a@e.com' }, { id: 'u2', email: 'b@e.com' }]);
      await evaluar([fila('A', 'rojo'), fila('B', 'rojo'), fila('C', 'verde')]);
      expect(notifications.create).toHaveBeenCalledTimes(2);
      const [tenantId, dto] = notifications.create.mock.calls[0];
      expect(tenantId).toBe('t1');
      expect(dto).toMatchObject({ canal: 'email', tipo: 'riesgo_rojo', destino: 'a@e.com', userId: 'u1', asunto: 'SUTL: 2 SKU pasaron a rojo' });
      expect(dto.mensaje).toContain('A:');
      expect(dto.mensaje).toContain('B:');
      expect(dto.mensaje).not.toContain('C:');
      expect(prisma.riskChange.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { avisado: true } }));
    });

    it('con un solo SKU el asunto lo nombra', async () => {
      await evaluar([fila('MP-1', 'rojo')]);
      expect(notifications.create.mock.calls[0][1].asunto).toBe('SUTL: MP-1 está en rojo');
    });

    it('solo avisa a administradores activos de la misma empresa', async () => {
      await evaluar([fila('A', 'rojo')]);
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', rol: 'admin_tenant', activo: true });
    });

    it('si la empresa lo desactivó, el cambio se registra pero no se avisa', async () => {
      config.getEfectiva.mockResolvedValue({ riesgo: { avisarAlPasarARojo: false } });
      await evaluar([fila('A', 'rojo')]);
      expect(prisma.riskChange.create).toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
      expect(prisma.riskChange.updateMany).not.toHaveBeenCalled();
    });

    it('pasar a amarillo o verde no genera correo', async () => {
      prisma.riskState.findMany.mockResolvedValue([estado('A', 'rojo'), estado('B', 'verde')]);
      await evaluar([fila('A', 'verde'), fila('B', 'amarillo')]);
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('si el correo falla, no se marca como avisado y la evaluación no se rompe', async () => {
      notifications.create.mockRejectedValue(new Error('SMTP caído'));
      const c = await evaluar([fila('A', 'rojo')]);
      expect(c).toHaveLength(1);
      expect(prisma.riskChange.updateMany).not.toHaveBeenCalled();
    });

    it('recorta la lista cuando son muchos SKU', async () => {
      await evaluar(Array.from({ length: 35 }, (_, i) => fila(`S${i}`, 'rojo')));
      const mensaje: string = notifications.create.mock.calls[0][1].mensaje;
      expect(mensaje).toContain('S29:');
      expect(mensaje).not.toContain('S30:');
      expect(mensaje).toContain('…y 5 más');
    });
  });

  describe('evaluarTodas (ronda programada)', () => {
    it('recorre las empresas activas con política y una que falla no frena a las demás', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }, { id: 't3' }]);
      risk.evaluar.mockImplementation((id: string) => (id === 't2' ? Promise.reject(new Error('rota')) : Promise.resolve({ filas: [fila('A', 'verde')] })));
      const r = await service.evaluarTodas();
      expect(r).toEqual({ empresas: 3, cambios: 2 });
      expect(prisma.tenant.findMany.mock.calls[0][0].where).toEqual({ activo: true, inventoryPolicies: { some: {} } });
    });
  });

  it('cambios() lista el historial de la empresa, lo más reciente primero', async () => {
    prisma.riskChange.findMany.mockResolvedValue([]);
    await service.cambios('t1');
    const arg = prisma.riskChange.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: 't1' });
    expect(arg.orderBy).toEqual({ createdAt: 'desc' });
    expect(arg.take).toBe(100);
  });
});
