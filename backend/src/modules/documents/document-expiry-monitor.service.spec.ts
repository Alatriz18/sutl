import { DocumentExpiryMonitorService } from './document-expiry-monitor.service';

const DIA = 86_400_000;
const hoy = new Date('2026-11-18T12:00:00Z');
const item = (id: string, estado: string, dias: number) => ({ id, codigoGuia: `SUTL-${id}`, tipo: 'factura', estado, diasParaVencer: dias, fechaVencimiento: new Date(hoy.getTime() + dias * DIA) });

function montar(opciones: { items?: unknown[]; admins?: unknown[]; avisar?: boolean; falla?: boolean; claim?: number } = {}) {
  const prisma = {
    document: { updateMany: jest.fn().mockResolvedValue({ count: opciones.claim ?? 1 }) },
    user: { findMany: jest.fn().mockResolvedValue(opciones.admins ?? [{ id: 'a1', email: 'a@x.com' }]) },
    tenant: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]) },
  };
  const documents = { proximosVencimientos: jest.fn().mockResolvedValue(opciones.items ?? [item('d1', 'por_vencer', 5), item('d2', 'vencido', -2)]) };
  const tenantConfig = { getEfectiva: jest.fn().mockResolvedValue({ documentos: { diasAvisoVencimiento: 15, avisarVencimientos: opciones.avisar ?? true } }) };
  const notifications = { create: opciones.falla ? jest.fn().mockRejectedValue(new Error('smtp')) : jest.fn().mockResolvedValue({}) };
  const service = new DocumentExpiryMonitorService(prisma as never, documents as never, tenantConfig as never, notifications as never);
  return { service, prisma, notifications, documents };
}

describe('DocumentExpiryMonitorService', () => {
  it('sin avisos activados no lee documentos ni escribe a nadie', async () => {
    const { service, documents, notifications } = montar({ avisar: false });
    expect(await service.avisarEmpresa('t1', hoy)).toEqual({ porVencer: 0, vencidos: 0, correos: 0 });
    expect(documents.proximosVencimientos).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('reclama cada documento de forma condicional (solo si aún no se avisó) y manda un solo correo por administrador', async () => {
    const { service, prisma, notifications } = montar();
    const r = await service.avisarEmpresa('t1', hoy);
    expect(r).toEqual({ porVencer: 1, vencidos: 1, correos: 1 });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', tenantId: 't1', avisoPorVencerAt: null }, data: { avisoPorVencerAt: hoy } });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({ where: { id: 'd2', tenantId: 't1', avisoVencidoAt: null }, data: { avisoVencidoAt: hoy } });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create.mock.calls[0][1]).toMatchObject({ canal: 'email', tipo: 'documento_vencimiento', destino: 'a@x.com' });
  });

  it('si otra ronda ya avisó (el reclamo no gana), no manda nada', async () => {
    const { service, notifications } = montar({ claim: 0 });
    expect(await service.avisarEmpresa('t1', hoy)).toEqual({ porVencer: 0, vencidos: 0, correos: 0 });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('si el correo falla o no hay administradores, libera el reclamo para reintentar luego', async () => {
    for (const o of [{ falla: true }, { admins: [] }]) {
      const { service, prisma } = montar(o);
      expect(await service.avisarEmpresa('t1', hoy)).toEqual({ porVencer: 0, vencidos: 0, correos: 0 });
      expect(prisma.document.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', tenantId: 't1' }, data: { avisoPorVencerAt: null } });
      expect(prisma.document.updateMany).toHaveBeenCalledWith({ where: { id: 'd2', tenantId: 't1' }, data: { avisoVencidoAt: null } });
    }
  });

  it('un documento aprobado y lejano no se avisa', async () => {
    const { service, notifications } = montar({ items: [item('d3', 'aprobado', 120)] });
    expect(await service.avisarEmpresa('t1', hoy)).toEqual({ porVencer: 0, vencidos: 0, correos: 0 });
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
