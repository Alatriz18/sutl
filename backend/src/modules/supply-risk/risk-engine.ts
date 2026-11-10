// Motor de riesgo de abastecimiento v1: función PURA (sin base de datos ni
// reloj propio) para poder probar cada regla con casos concretos.
//
// Idea: con el stock de hoy y el consumo diario se proyecta cuándo se acaba el
// SKU; las reposiciones con fecha (embarques en camino con ETA) se suman en su
// día. Si el stock llega a cero antes de que llegue lo que viene, hay quiebre.

export type Semaforo = 'rojo' | 'amarillo' | 'verde' | 'sin_datos';

export type AccionRecomendada =
  | 'adelantar_proveedor' // hay OC sin despachar: urgir al proveedor
  | 'partir_envio' // hay un embarque en camino que llega tarde: enviar parte antes
  | 'compra_urgente' // no hay nada en camino: comprar ya
  | 'confirmar_fecha' // la reposición no tiene fecha confiable
  | 'planificar_compra' // aún hay tiempo, pero hay que ordenar
  | 'ninguna';

export interface Reposicion {
  // null = se espera pero no hay fecha de llegada confiable (OC sin embarque).
  fecha: Date | null;
  cantidad: number;
  origen: 'embarque' | 'oc';
  referencia: string;
}

export interface EntradaRiesgo {
  hoy: Date;
  stock: number | null;
  consumoDiario: number | null;
  stockSeguridad: number;
  leadTimeDias: number | null;
  // Por debajo de estos días de cobertura total se pasa a amarillo.
  diasCoberturaAlerta: number;
  reposiciones: Reposicion[];
}

export interface ResultadoRiesgo {
  semaforo: Semaforo;
  accion: AccionRecomendada;
  motivo: string;
  // Primer día en que el stock llega a cero (considerando lo que llega a tiempo).
  fechaQuiebre: Date | null;
  // Días en que se queda sin stock antes de que llegue una reposición.
  diasSinStock: number;
  // Hasta cuándo alcanza todo lo que hay y lo que viene con fecha.
  cubiertoHasta: Date | null;
  fechaBajoSeguridad: Date | null;
  reposicionesSinFecha: number;
  reposicionesVencidas: number;
}

const DIA_MS = 86_400_000;
const sumarDias = (base: Date, dias: number) => new Date(base.getTime() + dias * DIA_MS);
const redondear = (n: number) => Math.round(n * 10) / 10;

export function evaluarRiesgo(e: EntradaRiesgo): ResultadoRiesgo {
  const base: ResultadoRiesgo = {
    semaforo: 'sin_datos',
    accion: 'ninguna',
    motivo: '',
    fechaQuiebre: null,
    diasSinStock: 0,
    cubiertoHasta: null,
    fechaBajoSeguridad: null,
    reposicionesSinFecha: 0,
    reposicionesVencidas: 0,
  };

  if (e.consumoDiario == null || !(e.consumoDiario > 0)) {
    return { ...base, motivo: 'Falta el consumo diario del SKU para proyectar el stock.' };
  }
  if (e.stock == null) {
    return { ...base, motivo: 'Falta el stock actual (la empresa aún no reporta existencias de este SKU).' };
  }

  const consumo = e.consumoDiario;
  const reposiciones = e.reposiciones.filter((r) => r.cantidad > 0);
  const sinFecha = reposiciones.filter((r) => r.fecha == null);
  // Una ETA que ya pasó y la mercadería sigue sin recibirse no es confiable:
  // no se cuenta como llegada (criterio conservador) y se avisa aparte.
  const vencidas = reposiciones.filter((r) => r.fecha != null && r.fecha.getTime() < e.hoy.getTime());
  const fechadas = reposiciones
    .filter((r) => r.fecha != null && r.fecha.getTime() >= e.hoy.getTime())
    .map((r) => ({ ...r, dias: (r.fecha!.getTime() - e.hoy.getTime()) / DIA_MS }))
    .sort((a, b) => a.dias - b.dias);

  let nivel = Math.max(e.stock, 0);
  let t = 0;
  let quiebreT: number | null = e.stock <= 0 ? 0 : null;
  let seguridadT: number | null = null;
  let diasSinStock = 0;
  const seg = e.stockSeguridad;

  const anotarSeguridad = (desde: number, nivelDesde: number, hasta: number) => {
    if (seg > 0 && seguridadT == null) {
      if (nivelDesde < seg) seguridadT = desde;
      else if (nivelDesde - consumo * (hasta - desde) < seg) seguridadT = desde + (nivelDesde - seg) / consumo;
    }
  };

  for (const r of fechadas) {
    const nivelAntes = nivel - consumo * (r.dias - t);
    anotarSeguridad(t, nivel, r.dias);
    if (nivelAntes < 0) {
      const t0 = t + nivel / consumo; // día en que se acaba
      diasSinStock += r.dias - t0;
      if (quiebreT == null) quiebreT = t0;
      nivel = r.cantidad;
    } else {
      nivel = nivelAntes + r.cantidad;
    }
    t = r.dias;
  }
  // Tras la última reposición conocida el stock siempre acabará bajando: eso lo
  // cubre la regla de cobertura total. Aquí solo importa si ya está por debajo.
  anotarSeguridad(t, nivel, t);
  const cubiertoT = t + nivel / consumo;
  if (quiebreT == null) quiebreT = cubiertoT;

  const hayFechadas = fechadas.length > 0;
  const enRiesgoDeQuiebre = diasSinStock > 0 || e.stock <= 0;
  const leadTimeInalcanzable = !hayFechadas && e.leadTimeDias != null && cubiertoT < e.leadTimeDias;

  const resultado: ResultadoRiesgo = {
    ...base,
    fechaQuiebre: sumarDias(e.hoy, quiebreT),
    diasSinStock: redondear(diasSinStock),
    cubiertoHasta: sumarDias(e.hoy, cubiertoT),
    fechaBajoSeguridad: seguridadT != null ? sumarDias(e.hoy, seguridadT) : null,
    reposicionesSinFecha: sinFecha.length,
    reposicionesVencidas: vencidas.length,
  };

  if (enRiesgoDeQuiebre || leadTimeInalcanzable) {
    const hayOcSinDespachar = sinFecha.some((r) => r.origen === 'oc');
    const hayEmbarque = fechadas.some((r) => r.origen === 'embarque') || vencidas.length > 0;
    resultado.semaforo = 'rojo';
    resultado.accion = hayOcSinDespachar ? 'adelantar_proveedor' : hayEmbarque ? 'partir_envio' : 'compra_urgente';
    resultado.motivo =
      e.stock <= 0
        ? 'Ya no hay stock.'
        : diasSinStock > 0
          ? `Se acaba en ${redondear(quiebreT)} días y la reposición llega ${redondear(diasSinStock)} días tarde.`
          : `Alcanza para ${redondear(cubiertoT)} días y el proveedor tarda ${e.leadTimeDias} días en reponer: no llega a tiempo.`;
    return resultado;
  }

  if (resultado.fechaBajoSeguridad || cubiertoT < e.diasCoberturaAlerta || vencidas.length > 0) {
    resultado.semaforo = 'amarillo';
    resultado.accion = vencidas.length > 0 || sinFecha.length > 0 ? 'confirmar_fecha' : 'planificar_compra';
    resultado.motivo =
      vencidas.length > 0
        ? 'Una llegada prevista ya venció y la mercadería no se recibió: confirma la fecha real.'
        : resultado.fechaBajoSeguridad
          ? seguridadT === 0
            ? 'El stock ya está por debajo del nivel de seguridad.'
            : 'El stock bajará del nivel de seguridad antes de la siguiente reposición.'
          : `La cobertura total (${redondear(cubiertoT)} días) está por debajo del umbral de ${e.diasCoberturaAlerta}.`;
    return resultado;
  }

  resultado.semaforo = 'verde';
  resultado.motivo = `Cobertura de ${redondear(cubiertoT)} días sin quiebres proyectados.`;
  return resultado;
}
