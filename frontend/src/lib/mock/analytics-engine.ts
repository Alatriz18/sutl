// Copia de backend/src/modules/analytics/analytics-engine.ts para el modo demo: mantener ambos iguales.
// Motor de analítica de abastecimiento: OTIF, lead time, aging y cumplimiento.
// Funciones puras (sin base de datos) con la fecha de hoy inyectada, para poder
// probarlas con fechas fijas. Definiciones (las mismas que se muestran en pantalla):
//
//  · Completa (in full): todas las líneas se recibieron al 100 % (o más).
//  · A tiempo (on time): la OC quedó completa a más tardar el día de su fecha
//    requerida. Una OC incompleta con la fecha ya vencida NO está a tiempo.
//  · OTIF: a tiempo y completa a la vez.
//  · Lead time: días entre emitir la OC y completar su recepción.
//  · Atraso: días después de la fecha requerida (hasta hoy si todavía no se completa).
//  · Cumplimiento de la promesa: el proveedor despachó a más tardar en la fecha
//    que él mismo confirmó.

const DIA_MS = 86_400_000;
const EPS = 1e-9;

export const ESTADOS_ABIERTOS = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'] as const;

export interface LineaAnalitica {
  cantidad: number;
  cantidadRecibida: number;
  recepciones: { fecha: Date }[];
}

export interface OcAnalitica {
  id: string;
  numero: string;
  proveedorId: string;
  proveedorNombre: string;
  estado: string;
  fechaEmision: Date;
  fechaRequerida: Date | null;
  fechaConfirmadaProveedor: Date | null;
  fechaDespacho: Date | null;
  lineas: LineaAnalitica[];
}

export interface EvaluacionOc {
  completa: boolean;
  fillRate: number; // 0..1
  fechaCompleta: Date | null;
  // null = no evaluable (sin fecha requerida, o todavía no vence y no está completa)
  aTiempo: boolean | null;
  otif: boolean | null;
  diasAtraso: number;
  leadTimeDias: number | null;
  cumplioPromesa: boolean | null;
}

// Una fecha requerida cuenta hasta el final de ese día.
const finDelDia = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
const redondear = (n: number, dec = 1) => Math.round(n * 10 ** dec) / 10 ** dec;

export function pct(parte: number, total: number): number | null {
  return total > 0 ? redondear((parte / total) * 100) : null;
}

export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const idx = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[idx];
}

export function promedio(valores: number[]): number | null {
  return valores.length ? redondear(valores.reduce((s, v) => s + v, 0) / valores.length) : null;
}

export function evaluarOc(oc: OcAnalitica, hoy: Date): EvaluacionOc {
  const pedido = oc.lineas.reduce((s, l) => s + l.cantidad, 0);
  const recibido = oc.lineas.reduce((s, l) => s + Math.min(l.cantidadRecibida, l.cantidad), 0);
  const fillRate = pedido > 0 ? Math.min(recibido / pedido, 1) : 0;
  const completa = oc.lineas.length > 0 && oc.lineas.every((l) => l.cantidadRecibida + EPS >= l.cantidad);
  const fechas = oc.lineas.flatMap((l) => l.recepciones.map((r) => r.fecha.getTime()));
  const fechaCompleta = completa && fechas.length > 0 ? new Date(Math.max(...fechas)) : null;

  const limite = oc.fechaRequerida ? finDelDia(oc.fechaRequerida) : null;
  let aTiempo: boolean | null = null;
  if (limite) {
    if (completa && fechaCompleta) aTiempo = fechaCompleta.getTime() <= limite.getTime();
    else if (limite.getTime() < hoy.getTime()) aTiempo = false; // venció sin completarse
  }

  let diasAtraso = 0;
  if (limite) {
    const referencia = completa && fechaCompleta ? fechaCompleta : hoy;
    diasAtraso = Math.max(0, Math.ceil((referencia.getTime() - limite.getTime()) / DIA_MS));
  }

  const cumplioPromesa =
    oc.fechaDespacho && oc.fechaConfirmadaProveedor
      ? oc.fechaDespacho.getTime() <= finDelDia(oc.fechaConfirmadaProveedor).getTime()
      : null;

  return {
    completa,
    fillRate,
    fechaCompleta,
    aTiempo,
    otif: aTiempo === null ? null : aTiempo && completa,
    diasAtraso,
    leadTimeDias: fechaCompleta ? redondear(Math.max(0, (fechaCompleta.getTime() - oc.fechaEmision.getTime()) / DIA_MS)) : null,
    cumplioPromesa,
  };
}

export interface ResumenOtif {
  ocsEvaluadas: number;
  aTiempo: number;
  completas: number;
  otif: number;
  pctATiempo: number | null;
  pctCompleto: number | null;
  pctOtif: number | null;
  fillRatePromedio: number | null; // %
  atrasoPromedioDias: number | null; // solo de las que se atrasaron
}

function resumenOtif(evals: EvaluacionOc[]): ResumenOtif {
  const evaluables = evals.filter((e) => e.aTiempo !== null);
  const aTiempo = evaluables.filter((e) => e.aTiempo).length;
  const completas = evaluables.filter((e) => e.completa).length;
  const otif = evaluables.filter((e) => e.otif).length;
  const atrasadas = evaluables.filter((e) => e.diasAtraso > 0).map((e) => e.diasAtraso);
  return {
    ocsEvaluadas: evaluables.length,
    aTiempo,
    completas,
    otif,
    pctATiempo: pct(aTiempo, evaluables.length),
    pctCompleto: pct(completas, evaluables.length),
    pctOtif: pct(otif, evaluables.length),
    fillRatePromedio: evaluables.length ? redondear((evaluables.reduce((s, e) => s + e.fillRate, 0) / evaluables.length) * 100) : null,
    atrasoPromedioDias: promedio(atrasadas),
  };
}

export interface FilaProveedor extends ResumenOtif {
  proveedorId: string;
  nombre: string;
  ocs: number;
  leadTimePromedioDias: number | null;
  pctCumplePromesa: number | null;
}

const BUCKETS_AGING = [
  { clave: 'al_dia', etiqueta: 'Al día o sin fecha', min: -Infinity, max: 0 },
  { clave: '1_7', etiqueta: '1 a 7 días de atraso', min: 1, max: 7 },
  { clave: '8_15', etiqueta: '8 a 15 días', min: 8, max: 15 },
  { clave: '16_30', etiqueta: '16 a 30 días', min: 16, max: 30 },
  { clave: 'mas_30', etiqueta: 'Más de 30 días', min: 31, max: Infinity },
] as const;

export function aging(abiertas: OcAnalitica[], hoy: Date) {
  const buckets = BUCKETS_AGING.map((b) => ({ clave: b.clave as string, etiqueta: b.etiqueta as string, ocs: 0 }));
  for (const oc of abiertas) {
    const { diasAtraso } = evaluarOc(oc, hoy);
    const i = BUCKETS_AGING.findIndex((b) => diasAtraso >= b.min && diasAtraso <= b.max);
    buckets[i === -1 ? 0 : i].ocs++;
  }
  return { totalAbiertas: abiertas.length, buckets };
}

export interface PuntoTendencia {
  mes: string; // AAAA-MM
  ocsEvaluadas: number;
  pctOtif: number | null;
}

const claveMes = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// Últimos `meses` meses (incluido el actual), agrupando por mes de la fecha requerida.
export function tendenciaMensual(ocs: OcAnalitica[], hoy: Date, meses = 6): PuntoTendencia[] {
  const claves: string[] = [];
  for (let i = meses - 1; i >= 0; i--) claves.push(claveMes(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1))));
  const porMes = new Map<string, EvaluacionOc[]>(claves.map((c) => [c, []]));
  for (const oc of ocs) {
    if (!oc.fechaRequerida) continue;
    const lista = porMes.get(claveMes(oc.fechaRequerida));
    if (lista) lista.push(evaluarOc(oc, hoy));
  }
  return claves.map((mes) => {
    const r = resumenOtif(porMes.get(mes) ?? []);
    return { mes, ocsEvaluadas: r.ocsEvaluadas, pctOtif: r.pctOtif };
  });
}

export function puntualidadEnvios(items: { llegadaEstimada: Date; entregadoAt: Date }[]) {
  const aTiempo = items.filter((i) => i.entregadoAt.getTime() <= finDelDia(i.llegadaEstimada).getTime()).length;
  const retrasos = items
    .map((i) => Math.ceil((i.entregadoAt.getTime() - finDelDia(i.llegadaEstimada).getTime()) / DIA_MS))
    .filter((d) => d > 0);
  return { entregados: items.length, aTiempo, pctATiempo: pct(aTiempo, items.length), retrasoPromedioDias: promedio(retrasos) };
}

// Resumen del periodo: las OC que vencían (fecha requerida) entre `desde` y `hasta`.
export function resumenAnalitica(ocsDelPeriodo: OcAnalitica[], hoy: Date) {
  const evals = ocsDelPeriodo.map((oc) => ({ oc, e: evaluarOc(oc, hoy) }));
  const leadTimes = evals.map((x) => x.e.leadTimeDias).filter((v): v is number => v !== null);

  const porProveedor = new Map<string, { nombre: string; items: typeof evals }>();
  for (const x of evals) {
    const g = porProveedor.get(x.oc.proveedorId) ?? { nombre: x.oc.proveedorNombre, items: [] };
    g.items.push(x);
    porProveedor.set(x.oc.proveedorId, g);
  }
  const proveedores: FilaProveedor[] = [...porProveedor.entries()]
    .map(([proveedorId, g]) => {
      const promesas = g.items.map((x) => x.e.cumplioPromesa).filter((v): v is boolean => v !== null);
      return {
        proveedorId,
        nombre: g.nombre,
        ocs: g.items.length,
        ...resumenOtif(g.items.map((x) => x.e)),
        leadTimePromedioDias: promedio(g.items.map((x) => x.e.leadTimeDias).filter((v): v is number => v !== null)),
        pctCumplePromesa: pct(promesas.filter(Boolean).length, promesas.length),
      };
    })
    // Peor desempeño primero: es lo que hay que atender. Sin datos evaluables, al final.
    .sort((a, b) => (a.pctOtif ?? 101) - (b.pctOtif ?? 101) || b.ocs - a.ocs || a.nombre.localeCompare(b.nombre));

  const promesas = evals.map((x) => x.e.cumplioPromesa).filter((v): v is boolean => v !== null);
  const emitidas = ocsDelPeriodo.length;
  const confirmadas = ocsDelPeriodo.filter((oc) => oc.fechaConfirmadaProveedor).length;

  return {
    otif: resumenOtif(evals.map((x) => x.e)),
    leadTime: {
      muestra: leadTimes.length,
      promedioDias: promedio(leadTimes),
      medianaDias: percentil(leadTimes, 50),
      p90Dias: percentil(leadTimes, 90),
    },
    cumplimiento: {
      ocs: emitidas,
      pctConfirmadas: pct(confirmadas, emitidas),
      conPromesaEvaluada: promesas.length,
      pctCumplePromesa: pct(promesas.filter(Boolean).length, promesas.length),
    },
    proveedores,
  };
}
