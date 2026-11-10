import { EntradaRiesgo, Reposicion, evaluarRiesgo } from './risk-engine';

const HOY = new Date('2026-11-10T12:00:00Z');
const enDias = (n: number) => new Date(HOY.getTime() + n * 86_400_000);
const base = (o: Partial<EntradaRiesgo> = {}): EntradaRiesgo => ({
  hoy: HOY,
  stock: 1000,
  consumoDiario: 100, // 10 días de cobertura
  stockSeguridad: 0,
  leadTimeDias: null,
  diasCoberturaAlerta: 15,
  reposiciones: [],
  ...o,
});
const embarque = (dias: number | null, cantidad: number): Reposicion => ({
  fecha: dias == null ? null : enDias(dias),
  cantidad,
  origen: 'embarque',
  referencia: 'SUTL-1',
});
const oc = (cantidad: number): Reposicion => ({ fecha: null, cantidad, origen: 'oc', referencia: 'OC-1' });

describe('evaluarRiesgo', () => {
  describe('sin datos', () => {
    it('sin consumo diario', () => {
      expect(evaluarRiesgo(base({ consumoDiario: null })).semaforo).toBe('sin_datos');
      expect(evaluarRiesgo(base({ consumoDiario: 0 })).semaforo).toBe('sin_datos');
    });
    it('sin stock reportado', () => {
      expect(evaluarRiesgo(base({ stock: null })).semaforo).toBe('sin_datos');
    });
  });

  describe('rojo', () => {
    it('la reposición llega después de que se acaba: calcula los días sin stock', () => {
      const r = evaluarRiesgo(base({ reposiciones: [embarque(15, 3000)] }));
      expect(r.semaforo).toBe('rojo');
      expect(r.diasSinStock).toBe(5); // se acaba al día 10, llega al 15
      expect(r.fechaQuiebre?.toISOString()).toBe(enDias(10).toISOString());
      expect(r.accion).toBe('partir_envio');
    });

    it('sin nada en camino y con OC sin despachar: pide adelantar al proveedor', () => {
      const r = evaluarRiesgo(base({ leadTimeDias: 30, reposiciones: [oc(5000)] }));
      expect(r.semaforo).toBe('rojo');
      expect(r.accion).toBe('adelantar_proveedor');
    });

    it('sin nada en camino ni pedido y el lead time no alcanza: compra urgente', () => {
      const r = evaluarRiesgo(base({ leadTimeDias: 30 }));
      expect(r.semaforo).toBe('rojo');
      expect(r.accion).toBe('compra_urgente');
      expect(r.motivo).toMatch(/30 días/);
    });

    it('stock en cero', () => {
      const r = evaluarRiesgo(base({ stock: 0 }));
      expect(r.semaforo).toBe('rojo');
      expect(r.motivo).toBe('Ya no hay stock.');
    });

    it('stock en cero y reposición a 4 días: 4 días sin stock', () => {
      const r = evaluarRiesgo(base({ stock: 0, reposiciones: [embarque(4, 5000)] }));
      expect(r.diasSinStock).toBe(4);
    });

    it('stock negativo se trata como cero', () => {
      expect(evaluarRiesgo(base({ stock: -50 })).semaforo).toBe('rojo');
    });
  });

  describe('amarillo', () => {
    it('cobertura total bajo el umbral, con tiempo de sobra de lead time', () => {
      const r = evaluarRiesgo(base({ leadTimeDias: 5 }));
      expect(r.semaforo).toBe('amarillo');
      expect(r.accion).toBe('planificar_compra');
    });

    it('baja del stock de seguridad antes de que llegue la reposición', () => {
      const r = evaluarRiesgo(base({ stockSeguridad: 400, reposiciones: [embarque(8, 10000)] }));
      expect(r.semaforo).toBe('amarillo');
      expect(r.fechaBajoSeguridad?.toISOString()).toBe(enDias(6).toISOString());
    });

    it('ya está bajo seguridad', () => {
      const r = evaluarRiesgo(base({ stock: 300, stockSeguridad: 400, reposiciones: [embarque(2, 10000)] }));
      expect(r.semaforo).toBe('amarillo');
      expect(r.motivo).toMatch(/ya está por debajo/);
    });

    it('una llegada vencida no se cuenta y se pide confirmar la fecha', () => {
      const r = evaluarRiesgo(base({ stock: 5000, reposiciones: [embarque(-3, 9000)] }));
      expect(r.reposicionesVencidas).toBe(1);
      expect(r.semaforo).toBe('amarillo');
      expect(r.accion).toBe('confirmar_fecha');
    });

    it('con OC sin fecha además de cobertura baja: confirmar fecha', () => {
      const r = evaluarRiesgo(base({ stock: 1200, leadTimeDias: 5, reposiciones: [oc(500)] }));
      expect(r.semaforo).toBe('amarillo');
      expect(r.accion).toBe('confirmar_fecha');
    });
  });

  describe('verde', () => {
    it('un stock de seguridad no marca amarillo si hay cobertura de sobra', () => {
      const r = evaluarRiesgo(base({ stock: 10000, stockSeguridad: 400 }));
      expect(r.semaforo).toBe('verde');
      expect(r.fechaBajoSeguridad).toBeNull();
    });

    it('tras la última reposición, con cobertura de sobra, tampoco', () => {
      const r = evaluarRiesgo(base({ stockSeguridad: 400, reposiciones: [embarque(5, 20000)] }));
      expect(r.semaforo).toBe('verde');
    });

    it('mucho stock: sin acción', () => {
      const r = evaluarRiesgo(base({ stock: 10000 }));
      expect(r.semaforo).toBe('verde');
      expect(r.accion).toBe('ninguna');
    });

    it('la reposición llega a tiempo y deja cobertura suficiente', () => {
      const r = evaluarRiesgo(base({ reposiciones: [embarque(6, 5000)] }));
      expect(r.semaforo).toBe('verde');
      expect(r.diasSinStock).toBe(0);
      // 1000 - 600 + 5000 = 5400 → 54 días desde el día 6
      expect(r.cubiertoHasta?.toISOString()).toBe(enDias(60).toISOString());
    });

    it('varias reposiciones encadenadas sin quiebre', () => {
      const r = evaluarRiesgo(base({ reposiciones: [embarque(9, 1000), embarque(18, 1500)] }));
      // día 9: 100+1000=1100 → día 18: 200+1500=1700 → 17 días más
      expect(r.diasSinStock).toBe(0);
      expect(r.cubiertoHasta?.toISOString()).toBe(enDias(35).toISOString());
      expect(r.semaforo).toBe('verde');
    });
  });

  it('ignora reposiciones con cantidad cero o negativa', () => {
    const r = evaluarRiesgo(base({ reposiciones: [embarque(2, 0), embarque(3, -10)] }));
    expect(r.cubiertoHasta?.toISOString()).toBe(enDias(10).toISOString());
  });

  it('el orden de las reposiciones no importa', () => {
    const a = evaluarRiesgo(base({ reposiciones: [embarque(18, 1500), embarque(9, 1000)] }));
    const b = evaluarRiesgo(base({ reposiciones: [embarque(9, 1000), embarque(18, 1500)] }));
    expect(a).toEqual(b);
  });

  it('no muta la entrada', () => {
    const rep = [embarque(18, 1500), embarque(9, 1000)];
    evaluarRiesgo(base({ reposiciones: rep }));
    expect(rep.map((r) => r.cantidad)).toEqual([1500, 1000]);
  });
});
