import { DocumentoVersion, estadoDelItem, evaluarChecklist, tiposRequeridos } from './checklist';

const HOY = new Date('2026-11-13T12:00:00Z');
const DIA = 86_400_000;
const CFG = {
  exigirFactura: true,
  exigirPackingList: true,
  exigirDocumentoTransporte: true,
  exigirPedimento: true,
  diasAvisoVencimiento: 15,
  diasAntesEtaFaltante: 5,
};

const doc = (p: Partial<DocumentoVersion> & Pick<DocumentoVersion, 'tipo'>): DocumentoVersion => ({
  id: `d-${p.tipo}-${p.version ?? 1}`,
  version: 1,
  estado: 'aprobado',
  fechaVencimiento: null,
  motivoRechazo: null,
  nombreArchivo: 'a.pdf',
  ...p,
});

describe('tiposRequeridos', () => {
  it('marítimo exige BL; aéreo, AWB; terrestre, ninguno de transporte', () => {
    expect(tiposRequeridos({ tipo: 'exportacion', modo: 'maritimo' }, CFG)).toEqual(['factura', 'packing_list', 'bl']);
    expect(tiposRequeridos({ tipo: 'exportacion', modo: 'aereo' }, CFG)).toEqual(['factura', 'packing_list', 'awb']);
    expect(tiposRequeridos({ tipo: 'exportacion', modo: 'terrestre' }, CFG)).toEqual(['factura', 'packing_list']);
  });

  it('el pedimento solo se exige en importaciones', () => {
    expect(tiposRequeridos({ tipo: 'importacion', modo: 'terrestre' }, CFG)).toContain('pedimento');
    expect(tiposRequeridos({ tipo: 'exportacion', modo: 'terrestre' }, CFG)).not.toContain('pedimento');
  });

  it('respeta lo que la empresa apagó', () => {
    const cfg = { ...CFG, exigirFactura: false, exigirPackingList: false, exigirDocumentoTransporte: false };
    expect(tiposRequeridos({ tipo: 'importacion', modo: 'maritimo' }, cfg)).toEqual(['pedimento']);
  });
});

describe('estadoDelItem', () => {
  it('sin documento: falta', () => {
    expect(estadoDelItem(undefined, 15, HOY)).toEqual({ estado: 'faltante', diasParaVencer: null });
  });

  it('un documento nuevo queda pendiente de revisión; rechazado se queda rechazado', () => {
    expect(estadoDelItem(doc({ tipo: 'factura', estado: 'pendiente' }), 15, HOY).estado).toBe('pendiente');
    expect(estadoDelItem(doc({ tipo: 'factura', estado: 'rechazado' }), 15, HOY).estado).toBe('rechazado');
  });

  it('vencido gana sobre aprobado; por vencer dentro de la ventana; lejos de vencer sigue aprobado', () => {
    expect(estadoDelItem(doc({ tipo: 'otro', fechaVencimiento: new Date(HOY.getTime() - DIA) }), 15, HOY).estado).toBe('vencido');
    expect(estadoDelItem(doc({ tipo: 'otro', fechaVencimiento: new Date(HOY.getTime() + 10 * DIA) }), 15, HOY)).toEqual({ estado: 'por_vencer', diasParaVencer: 10 });
    expect(estadoDelItem(doc({ tipo: 'otro', fechaVencimiento: new Date(HOY.getTime() + 60 * DIA) }), 15, HOY).estado).toBe('aprobado');
  });
});

describe('evaluarChecklist', () => {
  const envio = { tipo: 'importacion', modo: 'maritimo' } as const;

  it('está completo cuando todo lo requerido está aprobado', () => {
    const docs = (['factura', 'packing_list', 'bl', 'pedimento'] as const).map((t) => doc({ tipo: t }));
    const r = evaluarChecklist(envio, docs, CFG, HOY);
    expect(r.completo).toBe(true);
    expect(r.problemas).toEqual([]);
  });

  it('un documento por vencer sigue contando como cumplido', () => {
    const docs = (['factura', 'packing_list', 'bl', 'pedimento'] as const).map((t) =>
      doc({ tipo: t, fechaVencimiento: new Date(HOY.getTime() + 5 * DIA) }),
    );
    expect(evaluarChecklist(envio, docs, CFG, HOY).completo).toBe(true);
  });

  it('lista lo que falta, lo pendiente y lo rechazado', () => {
    const docs = [doc({ tipo: 'factura' }), doc({ tipo: 'packing_list', estado: 'pendiente' }), doc({ tipo: 'bl', estado: 'rechazado' })];
    const r = evaluarChecklist(envio, docs, CFG, HOY);
    expect(r.completo).toBe(false);
    expect(r.problemas).toEqual([
      { tipo: 'packing_list', estado: 'pendiente' },
      { tipo: 'bl', estado: 'rechazado' },
      { tipo: 'pedimento', estado: 'faltante' },
    ]);
  });

  it('solo cuenta la última versión de cada tipo', () => {
    const docs = [
      doc({ tipo: 'factura', version: 1, estado: 'aprobado' }),
      doc({ tipo: 'factura', version: 2, estado: 'pendiente' }),
    ];
    const r = evaluarChecklist({ tipo: 'exportacion', modo: 'terrestre' }, docs, { ...CFG, exigirPackingList: false }, HOY);
    expect(r.items[0]).toMatchObject({ tipo: 'factura', estado: 'pendiente' });
    expect(r.completo).toBe(false);
  });

  it('lo subido sin ser obligatorio aparece aparte y no bloquea', () => {
    const docs = [doc({ tipo: 'factura' }), doc({ tipo: 'packing_list' }), doc({ tipo: 'otro', estado: 'pendiente' })];
    const r = evaluarChecklist({ tipo: 'exportacion', modo: 'terrestre' }, docs, CFG, HOY);
    expect(r.extras.map((e) => e.tipo)).toEqual(['otro']);
    expect(r.completo).toBe(true);
  });
});
