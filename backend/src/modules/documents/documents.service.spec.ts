import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

const HOY = new Date('2026-11-13T12:00:00Z');
const DIA = 86_400_000;
const CFG_DOC = { exigirFactura: true, exigirPackingList: true, exigirDocumentoTransporte: true, exigirPedimento: false, diasAvisoVencimiento: 15, diasAntesEtaFaltante: 5 };

function montar() {
  const prisma = {
    shipment: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = { getEfectiva: jest.fn().mockResolvedValue({ documentos: CFG_DOC }) };
  const audit = { registrar: jest.fn().mockResolvedValue(undefined) };
  const service = new DocumentsService(prisma as never, config as never, audit as never);
  return { service, prisma, config, audit };
}

describe('DocumentsService', () => {
  describe('revisar', () => {
    it('rechazar exige un motivo', async () => {
      const { service, prisma } = montar();
      await expect(service.revisar('t1', 'u1', 'd1', { estado: 'rechazado', motivoRechazo: '  ' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.document.updateMany).not.toHaveBeenCalled();
    });

    it('un documento de otra empresa no existe', async () => {
      const { service, prisma } = montar();
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.revisar('t1', 'u1', 'd1', { estado: 'aprobado' })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.document.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'd1', tenantId: 't1' });
    });

    it('no se revisa una versión vieja si ya hay una más nueva', async () => {
      const { service, prisma } = montar();
      prisma.document.findFirst
        .mockResolvedValueOnce({ id: 'd1', shipmentId: 's1', tipo: 'factura', version: 1 })
        .mockResolvedValueOnce({ version: 2 });
      await expect(service.revisar('t1', 'u1', 'd1', { estado: 'aprobado' })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.document.updateMany).not.toHaveBeenCalled();
    });

    it('aprobar guarda quién y cuándo, limpia el motivo y deja registro en la bitácora', async () => {
      const { service, prisma, audit } = montar();
      const vigente = { id: 'd1', shipmentId: 's1', tipo: 'factura', version: 2 };
      prisma.document.findFirst.mockResolvedValue(vigente);
      await service.revisar('t1', 'u1', 'd1', { estado: 'aprobado' });
      const arg = prisma.document.updateMany.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'd1', tenantId: 't1' });
      expect(arg.data).toMatchObject({ estado: 'aprobado', motivoRechazo: null, revisadoPorId: 'u1' });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1', userId: 'u1', accion: 'documento.aprobado' }));
    });

    it('rechazar guarda el motivo sin espacios sobrantes', async () => {
      const { service, prisma, audit } = montar();
      prisma.document.findFirst.mockResolvedValue({ id: 'd1', shipmentId: 's1', tipo: 'bl', version: 1 });
      await service.revisar('t1', 'u1', 'd1', { estado: 'rechazado', motivoRechazo: '  Ilegible ' });
      expect(prisma.document.updateMany.mock.calls[0][0].data).toMatchObject({ estado: 'rechazado', motivoRechazo: 'Ilegible' });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'documento.rechazado' }));
    });
  });

  describe('checklist', () => {
    it('un envío de otra empresa no existe', async () => {
      const { service, prisma } = montar();
      prisma.shipment.findFirst.mockResolvedValue(null);
      await expect(service.checklist('t1', 's1', HOY)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.shipment.findFirst.mock.calls[0][0].where).toEqual({ id: 's1', tenantId: 't1' });
    });

    it('usa la configuración de la empresa y solo los documentos de ese envío y empresa', async () => {
      const { service, prisma } = montar();
      prisma.shipment.findFirst.mockResolvedValue({ id: 's1', codigoGuia: 'G-1', tipo: 'exportacion', modo: 'terrestre' });
      const r = await service.checklist('t1', 's1', HOY);
      expect(prisma.document.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', shipmentId: 's1' });
      expect(r.items.map((i) => i.tipo)).toEqual(['factura', 'packing_list']);
      expect(r.completo).toBe(false);
    });
  });

  describe('enviosConDocumentosPendientes', () => {
    it('trae solo envíos activos de la empresa que llegan dentro de la ventana configurada', async () => {
      const { service, prisma } = montar();
      await service.enviosConDocumentosPendientes('t1', HOY);
      const where = prisma.shipment.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ tenantId: 't1', estado: { not: 'entregado' } });
      expect(where.fechaEstimadaLlegada.lte).toEqual(new Date(HOY.getTime() + 5 * DIA));
    });

    it('reporta los incompletos como urgentes si llegan en 2 días o menos, y omite los completos', async () => {
      const { service, prisma } = montar();
      const aprobado = (tipo: string) => ({ id: `d-${tipo}`, tipo, version: 1, estado: 'aprobado', fechaVencimiento: null, motivoRechazo: null, nombreArchivo: 'a.pdf' });
      prisma.shipment.findMany.mockResolvedValue([
        { id: 's1', codigoGuia: 'G-1', tipo: 'exportacion', modo: 'terrestre', fechaEstimadaLlegada: new Date(HOY.getTime() + 4 * DIA), documentos: [] },
        { id: 's2', codigoGuia: 'G-2', tipo: 'exportacion', modo: 'terrestre', fechaEstimadaLlegada: new Date(HOY.getTime() + 1 * DIA), documentos: [] },
        { id: 's3', codigoGuia: 'G-3', tipo: 'exportacion', modo: 'terrestre', fechaEstimadaLlegada: new Date(HOY.getTime() + 1 * DIA), documentos: [aprobado('factura'), aprobado('packing_list')] },
      ]);
      const r = await service.enviosConDocumentosPendientes('t1', HOY);
      expect(r.map((x) => [x.shipmentId, x.urgente])).toEqual([['s1', false], ['s2', true]]);
      expect(r[0].detalle).toContain('Factura (falta)');
    });
  });

  describe('proximosVencimientos', () => {
    it('ignora versiones reemplazadas y documentos rechazados', async () => {
      const { service, prisma } = montar();
      const vence = new Date(HOY.getTime() + 3 * DIA);
      const base = { tipo: 'factura', estado: 'aprobado', fechaVencimiento: vence, motivoRechazo: null, nombreArchivo: 'a.pdf', shipmentId: 's1' };
      prisma.document.findMany
        .mockResolvedValueOnce([
          { ...base, id: 'viejo', version: 1, shipment: { codigoGuia: 'G-1' } },
          { ...base, id: 'nuevo', version: 2, shipment: { codigoGuia: 'G-1' } },
        ])
        .mockResolvedValueOnce([
          { ...base, id: 'viejo', version: 1 },
          { ...base, id: 'nuevo', version: 2 },
        ]);
      const r = await service.proximosVencimientos('t1', HOY);
      expect(r.map((x) => x.id)).toEqual(['nuevo']);
      expect(r[0]).toMatchObject({ codigoGuia: 'G-1', estado: 'por_vencer', diasParaVencer: 3 });
      expect(prisma.document.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 't1' });
    });
  });
});
