import { OcAnalitica, aging, evaluarOc, percentil, promedio, pct, puntualidadEnvios, resumenAnalitica, tendenciaMensual } from './analytics-engine';

const HOY = new Date('2026-11-14T12:00:00Z');
const d = (s: string) => new Date(`${s}T10:00:00Z`);

function oc(p: Partial<OcAnalitica> & { lineas?: OcAnalitica['lineas'] }): OcAnalitica {
  return {
    id: 'oc', numero: 'OC-1', proveedorId: 'p1', proveedorNombre: 'Proveedor 1', estado: 'recibida',
    fechaEmision: d('2026-09-01'), fechaRequerida: d('2026-10-01'), fechaConfirmadaProveedor: null, fechaDespacho: null,
    lineas: [{ cantidad: 100, cantidadRecibida: 100, recepciones: [{ fecha: d('2026-09-28') }] }],
    ...p,
  };
}

describe('helpers', () => {
  it('pct, promedio y percentil', () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(0, 0)).toBeNull();
    expect(promedio([1, 2, 4])).toBe(2.3);
    expect(promedio([])).toBeNull();
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentil([], 50)).toBeNull();
  });
});

describe('evaluarOc', () => {
  it('completa a tiempo = OTIF; lead time desde la emisión', () => {
    const e = evaluarOc(oc({}), HOY);
    expect(e).toMatchObject({ completa: true, aTiempo: true, otif: true, diasAtraso: 0, fillRate: 1 });
    expect(e.leadTimeDias).toBe(27);
  });

  it('la fecha requerida cuenta hasta el final de ese día', () => {
    const e = evaluarOc(oc({ fechaRequerida: d('2026-09-28'), lineas: [{ cantidad: 10, cantidadRecibida: 10, recepciones: [{ fecha: new Date('2026-09-28T23:00:00Z') }] }] }), HOY);
    expect(e.aTiempo).toBe(true);
  });

  it('completa pero tarde: completa sí, a tiempo no, con días de atraso', () => {
    const e = evaluarOc(oc({ lineas: [{ cantidad: 100, cantidadRecibida: 100, recepciones: [{ fecha: d('2026-10-06') }] }] }), HOY);
    expect(e).toMatchObject({ completa: true, aTiempo: false, otif: false });
    expect(e.diasAtraso).toBe(5);
  });

  it('vencida e incompleta: no está a tiempo ni completa y el atraso corre hasta hoy', () => {
    const e = evaluarOc(oc({ estado: 'recibida_parcial', lineas: [{ cantidad: 100, cantidadRecibida: 60, recepciones: [{ fecha: d('2026-09-28') }] }] }), HOY);
    expect(e).toMatchObject({ completa: false, aTiempo: false, otif: false, fechaCompleta: null, leadTimeDias: null });
    expect(e.fillRate).toBeCloseTo(0.6);
    expect(e.diasAtraso).toBe(44);
  });

  it('todavía no vence y no está completa: no es evaluable', () => {
    const e = evaluarOc(oc({ estado: 'confirmada', fechaRequerida: d('2026-12-01'), lineas: [{ cantidad: 100, cantidadRecibida: 0, recepciones: [] }] }), HOY);
    expect(e.aTiempo).toBeNull();
    expect(e.otif).toBeNull();
    expect(e.diasAtraso).toBe(0);
  });

  it('sin fecha requerida no se evalúa OTIF', () => {
    expect(evaluarOc(oc({ fechaRequerida: null }), HOY).aTiempo).toBeNull();
  });

  it('recibir de más no pasa del 100 % de llenado', () => {
    const e = evaluarOc(oc({ lineas: [{ cantidad: 100, cantidadRecibida: 130, recepciones: [{ fecha: d('2026-09-28') }] }] }), HOY);
    expect(e.fillRate).toBe(1);
    expect(e.completa).toBe(true);
  });

  it('cumplimiento de la promesa: despachó a más tardar en la fecha confirmada', () => {
    expect(evaluarOc(oc({ fechaConfirmadaProveedor: d('2026-09-10'), fechaDespacho: d('2026-09-10') }), HOY).cumplioPromesa).toBe(true);
    expect(evaluarOc(oc({ fechaConfirmadaProveedor: d('2026-09-10'), fechaDespacho: d('2026-09-12') }), HOY).cumplioPromesa).toBe(false);
    expect(evaluarOc(oc({ fechaConfirmadaProveedor: d('2026-09-10'), fechaDespacho: null }), HOY).cumplioPromesa).toBeNull();
  });
});

describe('resumenAnalitica', () => {
  const buena = oc({ id: 'a', proveedorId: 'p1', proveedorNombre: 'Bueno' });
  const tarde = oc({ id: 'b', proveedorId: 'p2', proveedorNombre: 'Tardío', lineas: [{ cantidad: 100, cantidadRecibida: 100, recepciones: [{ fecha: d('2026-10-10') }] }] });
  const incompleta = oc({ id: 'c', proveedorId: 'p2', proveedorNombre: 'Tardío', estado: 'recibida_parcial', lineas: [{ cantidad: 100, cantidadRecibida: 50, recepciones: [{ fecha: d('2026-09-30') }] }] });

  it('calcula OTIF, a tiempo y completo del periodo', () => {
    const r = resumenAnalitica([buena, tarde, incompleta], HOY);
    expect(r.otif).toMatchObject({ ocsEvaluadas: 3, aTiempo: 1, completas: 2, otif: 1, pctOtif: 33.3, pctATiempo: 33.3, pctCompleto: 66.7 });
    expect(r.otif.fillRatePromedio).toBe(83.3);
  });

  it('ordena a los proveedores del peor al mejor', () => {
    const r = resumenAnalitica([buena, tarde, incompleta], HOY);
    expect(r.proveedores.map((p) => [p.nombre, p.pctOtif, p.ocs])).toEqual([['Tardío', 0, 2], ['Bueno', 100, 1]]);
  });

  it('lead time: promedio, mediana y p90 solo de las completas', () => {
    const r = resumenAnalitica([buena, tarde, incompleta], HOY);
    expect(r.leadTime.muestra).toBe(2);
    expect(r.leadTime.promedioDias).toBe(33);
  });

  it('confirmación y promesa', () => {
    const confirmada = oc({ id: 'd', fechaConfirmadaProveedor: d('2026-09-10'), fechaDespacho: d('2026-09-12') });
    const r = resumenAnalitica([buena, confirmada], HOY);
    expect(r.cumplimiento).toMatchObject({ ocs: 2, pctConfirmadas: 50, conPromesaEvaluada: 1, pctCumplePromesa: 0 });
  });

  it('sin OC devuelve vacíos sin dividir por cero', () => {
    const r = resumenAnalitica([], HOY);
    expect(r.otif.pctOtif).toBeNull();
    expect(r.leadTime.promedioDias).toBeNull();
    expect(r.proveedores).toEqual([]);
  });
});

describe('aging', () => {
  it('reparte las OC abiertas por días de atraso', () => {
    const abiertas = [
      oc({ fechaRequerida: d('2026-12-01'), estado: 'confirmada', lineas: [{ cantidad: 1, cantidadRecibida: 0, recepciones: [] }] }), // al día
      oc({ fechaRequerida: null, estado: 'emitida', lineas: [{ cantidad: 1, cantidadRecibida: 0, recepciones: [] }] }), // sin fecha
      oc({ fechaRequerida: d('2026-11-10'), estado: 'emitida', lineas: [{ cantidad: 1, cantidadRecibida: 0, recepciones: [] }] }), // 4 días
      oc({ fechaRequerida: d('2026-11-01'), estado: 'emitida', lineas: [{ cantidad: 1, cantidadRecibida: 0, recepciones: [] }] }), // 13
      oc({ fechaRequerida: d('2026-10-20'), estado: 'emitida', lineas: [{ cantidad: 1, cantidadRecibida: 0, recepciones: [] }] }), // 25
      oc({ fechaRequerida: d('2026-08-01'), estado: 'emitida', lineas: [{ cantidad: 1, cantidadRecibida: 0, recepciones: [] }] }), // 105
    ];
    const r = aging(abiertas, HOY);
    expect(r.totalAbiertas).toBe(6);
    expect(r.buckets.map((b) => b.ocs)).toEqual([2, 1, 1, 1, 1]);
  });
});

describe('tendenciaMensual', () => {
  it('agrupa por mes de la fecha requerida, con los últimos 6 meses aunque estén vacíos', () => {
    const t = tendenciaMensual([oc({ fechaRequerida: d('2026-10-05') }), oc({ fechaRequerida: d('2026-10-20'), lineas: [{ cantidad: 1, cantidadRecibida: 0, recepciones: [] }], estado: 'emitida' })], HOY);
    expect(t).toHaveLength(6);
    expect(t.map((p) => p.mes)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(t[4]).toEqual({ mes: '2026-10', ocsEvaluadas: 2, pctOtif: 50 });
    expect(t[5].pctOtif).toBeNull();
  });
});

describe('puntualidadEnvios', () => {
  it('cuenta los entregados a más tardar el día estimado', () => {
    const r = puntualidadEnvios([
      { llegadaEstimada: d('2026-11-01'), entregadoAt: d('2026-10-30') },
      { llegadaEstimada: d('2026-11-01'), entregadoAt: d('2026-11-04') },
    ]);
    expect(r).toEqual({ entregados: 2, aTiempo: 1, pctATiempo: 50, retrasoPromedioDias: 3 });
    expect(puntualidadEnvios([]).pctATiempo).toBeNull();
  });
});
