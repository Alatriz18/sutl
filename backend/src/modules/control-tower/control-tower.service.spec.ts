import { ControlTowerService } from './control-tower.service';

const HOY = new Date('2026-11-13T15:00:00Z');
const DIA = 86_400_000;

function montar() {
  const prisma = {
    purchaseOrder: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    shipment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    exceptionCase: { groupBy: jest.fn().mockResolvedValue([]) },
    task: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  };
  const risk = {
    evaluar: jest.fn().mockResolvedValue({
      evaluadoAt: HOY,
      resumen: { rojo: 1, amarillo: 1, verde: 1, sinDatos: 0, acciones: {} },
      filas: [
        { sku: 'A', descripcion: null, semaforo: 'rojo', accion: 'compra_urgente', motivo: 'm', fechaQuiebre: HOY, diasSinStock: 3 },
        { sku: 'B', descripcion: null, semaforo: 'amarillo', accion: 'confirmar_fecha', motivo: 'm', fechaQuiebre: null, diasSinStock: 0 },
        { sku: 'C', descripcion: null, semaforo: 'verde', accion: 'ninguna', motivo: 'm', fechaQuiebre: null, diasSinStock: 0 },
      ],
    }),
  };
  const service = new ControlTowerService(prisma as never, risk as never);
  return { service, prisma, risk };
}

describe('ControlTowerService', () => {
  it('filtra todo por tenantId', async () => {
    const { service, prisma, risk } = montar();
    await service.resumen('t1', 'u1', HOY);
    expect(risk.evaluar).toHaveBeenCalledWith('t1', HOY);
    for (const llamada of [...prisma.purchaseOrder.findMany.mock.calls, ...prisma.purchaseOrder.count.mock.calls, ...prisma.shipment.findMany.mock.calls, ...prisma.shipment.count.mock.calls, ...prisma.exceptionCase.groupBy.mock.calls, ...prisma.task.count.mock.calls, ...prisma.task.findMany.mock.calls]) {
      expect(llamada[0].where.tenantId).toBe('t1');
    }
  });

  it('solo trae las tareas del usuario que consulta', async () => {
    const { service, prisma } = montar();
    await service.resumen('t1', 'u1', HOY);
    expect(prisma.task.findMany.mock.calls[0][0].where.asignadoAId).toBe('u1');
  });

  it('lista solo SKU en rojo y amarillo como críticos', async () => {
    const { service } = montar();
    const r = await service.resumen('t1', 'u1', HOY);
    expect(r.riesgo.criticos.map((c) => c.sku)).toEqual(['A', 'B']);
    expect(r.riesgo.resumen.rojo).toBe(1);
  });

  it('calcula los días de atraso de las OC', async () => {
    const { service, prisma } = montar();
    prisma.purchaseOrder.findMany.mockResolvedValueOnce([
      { id: 'o1', numero: 'OC-1', fechaRequerida: new Date(HOY.getTime() - 3 * DIA), proveedor: { nombre: 'Prov' } },
    ]);
    prisma.purchaseOrder.count.mockResolvedValueOnce(4);
    const r = await service.resumen('t1', 'u1', HOY);
    expect(r.ocsAtrasadas.total).toBe(4);
    expect(r.ocsAtrasadas.items[0]).toMatchObject({ numero: 'OC-1', proveedor: 'Prov', diasAtraso: 3 });
  });

  it('suma las excepciones abiertas por severidad', async () => {
    const { service, prisma } = montar();
    prisma.exceptionCase.groupBy.mockResolvedValueOnce([
      { severidad: 'critica', _count: { _all: 2 } },
      { severidad: 'alta', _count: { _all: 3 } },
      { severidad: 'media', _count: { _all: 1 } },
    ]);
    const r = await service.resumen('t1', 'u1', HOY);
    expect(r.excepciones).toEqual({ abiertas: 6, criticas: 2, altas: 3, medias: 1 });
  });

  it('usa una ventana de 7 días para los vencimientos próximos', async () => {
    const { service, prisma } = montar();
    const r = await service.resumen('t1', 'u1', HOY);
    const filtro = prisma.shipment.findMany.mock.calls[0][0].where.fechaEstimadaLlegada;
    expect(filtro.lte.getTime() - filtro.gte.getTime()).toBe(7 * DIA);
    expect(r.ventanaDias).toBe(7);
  });
});
