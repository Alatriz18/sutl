import { ExceptionsService } from './exceptions.service';

type Mock = jest.Mock;

describe('ExceptionsService', () => {
  const hoy = new Date('2026-11-13T12:00:00Z');
  const hora = 3_600_000;
  const dia = 86_400_000;
  let prisma: {
    exceptionCase: { findMany: Mock; create: Mock; update: Mock; updateMany: Mock };
    purchaseOrder: { findMany: Mock };
    user: { findFirst: Mock; findMany: Mock };
    task: { create: Mock };
  };
  let risk: { evaluar: Mock };
  let config: { getEfectiva: Mock };
  let audit: { registrar: Mock };
  let notifications: { create: Mock };
  let service: ExceptionsService;
  let existentes: Record<string, unknown>[];

  const caso = (o: Record<string, unknown>) => ({
    id: 'e1', tenantId: 't1', tipo: 'sku_en_rojo', clave: 'A', severidad: 'alta', titulo: 'SKU A en rojo', detalle: 'x',
    estado: 'abierta', taskId: null, venceSlaAt: new Date(hoy.getTime() + 5 * hora), escaladaAt: null, resueltaAt: null, ...o,
  });

  beforeEach(() => {
    existentes = [];
    prisma = {
      exceptionCase: {
        // 1ª llamada: todos los casos de la empresa; 2ª: los vencidos sin escalar.
        findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.venceSlaAt ? existentes.filter((e) => e.estado === 'abierta' && !e.escaladaAt && (e.venceSlaAt as Date) < hoy) : existentes)),
        create: jest.fn().mockResolvedValue({ id: 'nuevo' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      purchaseOrder: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'u-admin' }), findMany: jest.fn().mockResolvedValue([{ id: 'u-admin', email: 'a@x.com' }]) },
      task: { create: jest.fn().mockResolvedValue({ id: 'k1' }) },
    };
    risk = { evaluar: jest.fn().mockResolvedValue({ filas: [] }) };
    config = { getEfectiva: jest.fn().mockResolvedValue({ excepciones: { slaAltaHoras: 24, slaMediaHoras: 72, crearTareas: true } }) };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    service = new ExceptionsService(prisma as never, risk as never, config as never, audit as never, notifications as never);
  });

  it('un SKU en rojo abre una excepción grave con plazo de 24 h y una tarea', async () => {
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'Se acaba el 20 de nov.' }, { sku: 'B', semaforo: 'verde', motivo: '' }] });
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r).toEqual({ abiertas: 1, resueltas: 0, escaladas: 0 });
    const data = prisma.exceptionCase.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenantId: 't1', tipo: 'sku_en_rojo', clave: 'A', severidad: 'alta' });
    expect(data.venceSlaAt).toEqual(new Date(hoy.getTime() + 24 * hora));
    expect(prisma.task.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', creadoPorId: 'u-admin', entidadTipo: 'sku', entidadId: 'A', prioridad: 'alta' });
    expect(prisma.exceptionCase.update).toHaveBeenCalledWith({ where: { id: 'nuevo' }, data: { taskId: 'k1' } });
  });

  it('una OC atrasada pocos días es moderada (72 h); más de 7 días, grave (24 h)', async () => {
    prisma.purchaseOrder.findMany.mockResolvedValue([
      { id: 'oc1', numero: 'OC-1', fechaRequerida: new Date(hoy.getTime() - 3 * dia), proveedor: { nombre: 'Prov' } },
      { id: 'oc2', numero: 'OC-2', fechaRequerida: new Date(hoy.getTime() - 10 * dia), proveedor: { nombre: 'Prov' } },
    ]);
    await service.evaluarEmpresa('t1', hoy);
    const [a, b] = prisma.exceptionCase.create.mock.calls.map((c) => c[0].data);
    expect(a).toMatchObject({ clave: 'oc1', severidad: 'media' });
    expect(a.venceSlaAt).toEqual(new Date(hoy.getTime() + 72 * hora));
    expect(b).toMatchObject({ clave: 'oc2', severidad: 'alta' });
    expect(a.detalle).toContain('hace 3 días');
    expect(prisma.purchaseOrder.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', fechaRequerida: { lt: hoy } });
  });

  it('si la empresa apagó las tareas, abre la excepción sin tarea', async () => {
    config.getEfectiva.mockResolvedValue({ excepciones: { slaAltaHoras: 24, slaMediaHoras: 72, crearTareas: false } });
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    await service.evaluarEmpresa('t1', hoy);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('el plazo sale de la configuración de la empresa', async () => {
    config.getEfectiva.mockResolvedValue({ excepciones: { slaAltaHoras: 4, slaMediaHoras: 8, crearTareas: true } });
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    await service.evaluarEmpresa('t1', hoy);
    expect(prisma.exceptionCase.create.mock.calls[0][0].data.venceSlaAt).toEqual(new Date(hoy.getTime() + 4 * hora));
  });

  it('sin administrador activo no hay quien "cree" la tarea: la excepción igual se abre', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r.abiertas).toBe(1);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('una excepción abierta que sigue igual no se duplica', async () => {
    existentes = [caso({})];
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r).toEqual({ abiertas: 0, resueltas: 0, escaladas: 0 });
    expect(prisma.exceptionCase.create).not.toHaveBeenCalled();
  });

  it('cuando el problema desaparece, la excepción se resuelve sola (condicional al estado)', async () => {
    existentes = [caso({})];
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r.resueltas).toBe(1);
    expect(prisma.exceptionCase.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'e1', tenantId: 't1', estado: 'abierta' }, data: { estado: 'resuelta', resueltaAt: hoy } });
    expect(audit.registrar.mock.calls.some((c) => c[0].accion === 'excepcion.resuelta')).toBe(true);
  });

  it('si el problema vuelve, se reabre la misma excepción con plazo nuevo', async () => {
    existentes = [caso({ estado: 'resuelta', escaladaAt: new Date(), resueltaAt: new Date() })];
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r.abiertas).toBe(1);
    expect(prisma.exceptionCase.create).not.toHaveBeenCalled();
    const llamada = prisma.exceptionCase.updateMany.mock.calls[0][0];
    expect(llamada.where).toMatchObject({ id: 'e1', estado: 'resuelta' });
    expect(llamada.data).toMatchObject({ estado: 'abierta', escaladaAt: null, resueltaAt: null });
  });

  it('con el plazo vencido escala una vez a crítica y avisa en un solo correo por administrador', async () => {
    existentes = [
      caso({ id: 'e1', clave: 'A', venceSlaAt: new Date(hoy.getTime() - hora) }),
      caso({ id: 'e2', clave: 'B', titulo: 'SKU B en rojo', venceSlaAt: new Date(hoy.getTime() - 2 * hora) }),
    ];
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }, { sku: 'B', semaforo: 'rojo', motivo: 'm' }] });
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r.escaladas).toBe(2);
    expect(prisma.exceptionCase.updateMany.mock.calls.filter((c) => c[0].data.severidad === 'critica')).toHaveLength(2);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][1]).toMatchObject({ canal: 'email', tipo: 'excepcion_escalada', destino: 'a@x.com' });
    expect(notifications.create.mock.calls[0][1].asunto).toContain('2 excepciones');
  });

  it('una excepción ya escalada no se vuelve a escalar ni a avisar', async () => {
    existentes = [caso({ venceSlaAt: new Date(hoy.getTime() - hora), escaladaAt: new Date(hoy.getTime() - 30 * 60_000), severidad: 'critica' })];
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r.escaladas).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('si otra evaluación ya escaló (conteo 0), no avisa dos veces', async () => {
    existentes = [caso({ venceSlaAt: new Date(hoy.getTime() - hora) })];
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    prisma.exceptionCase.updateMany.mockResolvedValue({ count: 0 });
    const r = await service.evaluarEmpresa('t1', hoy);
    expect(r.escaladas).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('un correo que falla no rompe la evaluación', async () => {
    existentes = [caso({ venceSlaAt: new Date(hoy.getTime() - hora) })];
    risk.evaluar.mockResolvedValue({ filas: [{ sku: 'A', semaforo: 'rojo', motivo: 'm' }] });
    notifications.create.mockRejectedValue(new Error('SMTP caído'));
    await expect(service.evaluarEmpresa('t1', hoy)).resolves.toMatchObject({ escaladas: 1 });
  });

  it('la ronda general no se detiene si una empresa falla', async () => {
    (prisma as unknown as { tenant: { findMany: Mock } }).tenant = { findMany: jest.fn().mockResolvedValue([{ id: 'malo' }, { id: 'bueno' }]) };
    const original = service.evaluarEmpresa.bind(service);
    jest.spyOn(service, 'evaluarEmpresa').mockImplementation((id: string, h?: Date) => (id === 'malo' ? Promise.reject(new Error('boom')) : original(id, h)));
    const r = await service.evaluarTodas();
    expect(r.empresas).toBe(2);
  });
});
