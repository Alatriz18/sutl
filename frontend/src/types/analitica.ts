// Analítica de abastecimiento (ver backend/src/modules/analytics).

export interface ResumenOtif {
  ocsEvaluadas: number;
  aTiempo: number;
  completas: number;
  otif: number;
  pctATiempo: number | null;
  pctCompleto: number | null;
  pctOtif: number | null;
  fillRatePromedio: number | null;
  atrasoPromedioDias: number | null;
}

export interface FilaProveedorAnalitica extends ResumenOtif {
  proveedorId: string;
  nombre: string;
  ocs: number;
  leadTimePromedioDias: number | null;
  pctCumplePromesa: number | null;
}

export interface AnaliticaResumen {
  periodo: { desde: string; hasta: string };
  generadoAt: string;
  // Metas de la empresa para colorear el OTIF (verde ≥ otifPct, ámbar ≥ atencionOtifPct, rojo por debajo).
  metas: { otifPct: number; atencionOtifPct: number };
  otif: ResumenOtif;
  leadTime: { muestra: number; promedioDias: number | null; medianaDias: number | null; p90Dias: number | null };
  cumplimiento: { ocs: number; pctConfirmadas: number | null; conPromesaEvaluada: number; pctCumplePromesa: number | null };
  proveedores: FilaProveedorAnalitica[];
  aging: { totalAbiertas: number; buckets: { clave: string; etiqueta: string; ocs: number }[] };
  tendencia: { mes: string; ocsEvaluadas: number; pctOtif: number | null }[];
  envios: { entregados: number; aTiempo: number; pctATiempo: number | null; retrasoPromedioDias: number | null };
}
