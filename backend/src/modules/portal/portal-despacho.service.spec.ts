import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestUser } from '../../common/interfaces/jwt-payload.interface';
import { PortalDespachoService } from './portal-despacho.service';

const DIA = 86_400_000;
const user: RequestUser = { userId: 'u1', tenantId: 't1', rol: 'proveedor', email: 'p@x.com' };
const orden = (estado = 'confirmada') => ({ estado, numero: 'OC-1', lineas: [{ id: 'l1' }] });
const dto = (o: Record<string, unknown> = {}) => ({ modo: 'maritimo', origen: 'A', destino: 'B', fechaDespacho: new Date(Date.now() - DIA).toISOString(), lineas: [{ lineaId: 'l1', cantidad: 3 }], ...o }) as never;

function montar() {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ nombre: 'Empresa' }) },
    partner: { findFirst: jest.fn().mockResolvedValue({ nombre: 'Prov' }) },
    shipmentPurchaseOrderLine: { findMany: jest.fn().mockResolvedValue([]) },
    shipment: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    purchaseOrder: { updateMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const ordenes = {
    proveedorDe: jest.fn().mockResolvedValue('p1'),
    findOneDeProveedor: jest.fn().mockResolvedValue(orden()),
    findOne: jest.fn().mockResolvedValue({ estado: 'confirmada' }),
    transicion: jest.fn().mockResolvedValue({}),
  };
  const vinculos = { vincular: jest.fn().mockResolvedValue({}) };
  const envios = { create: jest.fn().mockResolvedValue({ id: 's1', codigoGuia: 'SUTL-1' }), publicarCreado: jest.fn() };
  const service = new PortalDespachoService(prisma as never, audit as never, ordenes as never, vinculos as never, envios as never);
  return { service, prisma, audit, ordenes, vinculos, envios };
}

describe('PortalDespachoService', () => {
  it('una orden ajena responde 404 antes de crear nada', async () => {
    const { service, ordenes, envios } = montar();
    ordenes.findOneDeProveedor.mockRejectedValue(new NotFoundException());
    await expect(service.despachar(user, 'oc-ajena', dto())).rejects.toBeInstanceOf(NotFoundException);
    expect(ordenes.findOneDeProveedor).toHaveBeenCalledWith('t1', 'p1', 'oc-ajena');
    expect(envios.create).not.toHaveBeenCalled();
  });

  it.each([['emitida'], ['borrador'], ['recibida'], ['cancelada']])('no se despacha una orden %s', async (estado) => {
    const { service, ordenes, envios } = montar();
    ordenes.findOneDeProveedor.mockResolvedValue(orden(estado));
    await expect(service.despachar(user, 'oc1', dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(envios.create).not.toHaveBeenCalled();
  });

  it('rechaza fechas del futuro, muy antiguas o una llegada anterior a la salida', async () => {
    const { service, envios } = montar();
    await expect(service.despachar(user, 'oc1', dto({ fechaDespacho: new Date(Date.now() + 3 * DIA).toISOString() }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.despachar(user, 'oc1', dto({ fechaDespacho: new Date(Date.now() - 45 * DIA).toISOString() }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.despachar(user, 'oc1', dto({ fechaEstimadaLlegada: new Date(Date.now() - 10 * DIA).toISOString() }))).rejects.toBeInstanceOf(BadRequestException);
    expect(envios.create).not.toHaveBeenCalled();
  });

  it('rechaza líneas que no son de la orden o repetidas', async () => {
    const { service, envios } = montar();
    await expect(service.despachar(user, 'oc1', dto({ lineas: [{ lineaId: 'ajena', cantidad: 1 }] }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.despachar(user, 'oc1', dto({ lineas: [{ lineaId: 'l1', cantidad: 1 }, { lineaId: 'l1', cantidad: 1 }] }))).rejects.toBeInstanceOf(BadRequestException);
    expect(envios.create).not.toHaveBeenCalled();
  });

  it('si no se puede asignar la carga, el embarque creado se deshace y no se anuncia', async () => {
    const { service, prisma, vinculos, envios, audit } = montar();
    vinculos.vincular.mockRejectedValue(new BadRequestException('excede lo pedido'));
    await expect(service.despachar(user, 'oc1', dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.shipment.deleteMany).toHaveBeenCalledWith({ where: { id: 's1', tenantId: 't1' } });
    expect(envios.publicarCreado).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('crea el embarque sin anunciarlo, asigna la carga, despacha con la fecha real, anuncia y deja bitácora', async () => {
    const { service, envios, vinculos, ordenes, audit } = montar();
    const fecha = new Date(Date.now() - 2 * DIA).toISOString();
    await service.despachar(user, 'oc1', dto({ fechaDespacho: fecha }));
    expect(envios.create).toHaveBeenCalledWith('t1', expect.objectContaining({ remitenteNombre: 'Prov', destinatarioNombre: 'Empresa', tipo: 'importacion' }), { avisar: false });
    expect(vinculos.vincular).toHaveBeenCalledWith('t1', 'oc1', { shipmentId: 's1', lineas: [{ lineaId: 'l1', cantidad: 3 }] });
    expect(ordenes.transicion).toHaveBeenCalledWith('t1', 'oc1', { estado: 'despachada', fechaDespacho: new Date(fecha).toISOString() });
    expect(envios.publicarCreado).toHaveBeenCalledTimes(1);
    expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'portal.orden_despachada', entidadId: 'oc1' }));
  });

  it('en un segundo despacho no toca la fecha de despacho de la orden', async () => {
    const { service, ordenes, prisma } = montar();
    ordenes.findOneDeProveedor.mockResolvedValue(orden('despachada'));
    await service.despachar(user, 'oc1', dto());
    expect(ordenes.transicion).not.toHaveBeenCalled();
    expect(prisma.purchaseOrder.updateMany).not.toHaveBeenCalled();
  });
});
