import type { AnaliticaResumen } from '@/types/analitica';
import { Celda, HojaXlsx } from './xlsx';

const fecha = (iso: string) => iso.slice(0, 10);

// Arma las hojas del Excel de la analítica con lo mismo que se ve en pantalla (números reales, no texto,
// para que la empresa pueda filtrar y calcular encima). Los porcentajes van como número de 0 a 100.
export function hojasAnalitica(d: AnaliticaResumen): HojaXlsx[] {
  const resumen: Celda[][] = [
    ['Analítica de abastecimiento'],
    ['Periodo', `${fecha(d.periodo.desde)} a ${fecha(d.periodo.hasta)}`],
    ['Generado', fecha(d.generadoAt)],
    ['Meta de OTIF (%)', d.metas.otifPct],
    ['Umbral de atención del OTIF (%)', d.metas.atencionOtifPct],
    [],
    ['Indicador', 'Valor'],
    ['Órdenes evaluadas', d.otif.ocsEvaluadas],
    ['OTIF (%)', d.otif.pctOtif],
    ['A tiempo (%)', d.otif.pctATiempo],
    ['Completas (%)', d.otif.pctCompleto],
    ['Se recibió de lo pedido (%)', d.otif.fillRatePromedio],
    ['Atraso promedio de las atrasadas (días)', d.otif.atrasoPromedioDias],
    ['Lead time promedio (días)', d.leadTime.promedioDias],
    ['Lead time mediana (días)', d.leadTime.medianaDias],
    ['Lead time P90 (días)', d.leadTime.p90Dias],
    ['Órdenes con fecha confirmada (%)', d.cumplimiento.pctConfirmadas],
    ['Despachó en la fecha prometida (%)', d.cumplimiento.pctCumplePromesa],
    ['Envíos entregados', d.envios.entregados],
    ['Envíos entregados a tiempo (%)', d.envios.pctATiempo],
    ['Retraso promedio de los envíos tardíos (días)', d.envios.retrasoPromedioDias],
  ];
  const proveedores: Celda[][] = [
    ['Proveedor', 'OC', 'OTIF (%)', 'A tiempo (%)', 'Completas (%)', 'Se recibió de lo pedido (%)', 'Atraso promedio (días)', 'Lead time (días)', 'Cumple promesa (%)', 'Cumple la meta'],
    ...d.proveedores.map((p): Celda[] => [
      p.nombre,
      p.ocs,
      p.pctOtif,
      p.pctATiempo,
      p.pctCompleto,
      p.fillRatePromedio,
      p.atrasoPromedioDias,
      p.leadTimePromedioDias,
      p.pctCumplePromesa,
      p.pctOtif === null ? '' : p.pctOtif >= d.metas.otifPct ? 'Sí' : 'No',
    ]),
  ];
  const tendencia: Celda[][] = [['Mes', 'OC evaluadas', 'OTIF (%)'], ...d.tendencia.map((t): Celda[] => [t.mes, t.ocsEvaluadas, t.pctOtif])];
  const atraso: Celda[][] = [['Rango de atraso', 'OC abiertas'], ...d.aging.buckets.map((b): Celda[] => [b.etiqueta, b.ocs]), ['Total abiertas', d.aging.totalAbiertas]];

  return [
    { nombre: 'Resumen', filas: resumen, anchos: [46, 28], encabezados: 1 },
    { nombre: 'Proveedores', filas: proveedores, anchos: [32, 8, 11, 13, 14, 26, 22, 16, 18, 15], encabezados: 1 },
    { nombre: 'Tendencia', filas: tendencia, anchos: [12, 14, 12], encabezados: 1 },
    { nombre: 'Atraso de OC abiertas', filas: atraso, anchos: [30, 14], encabezados: 1 },
  ];
}
