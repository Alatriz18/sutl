import { Excepcion, ResultadoExcepciones } from '@/types';
import * as db from './data';
import { riesgo } from './supply';
import { configEfectivaDemo } from './tenant-config';

// Centro de excepciones del modo demo (en memoria). Replica las reglas del
// backend: SKU en rojo → grave; OC atrasada → moderada (grave si pasa de 7 días);
// se resuelve sola, se reabre y escala cuando vence el plazo.

const HORA = 3_600_000;
const DIA = 86_400_000;
const VIGENTES = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];
const casos = new Map<string, Excepcion>();
let contador = 0;

export function listarExcepciones(estado?: string): Excepcion[] {
  return [...casos.values()]
    .filter((c) => !estado || c.estado === estado)
    .sort((a, b) => (a.estado === b.estado ? a.venceSlaAt.localeCompare(b.venceSlaAt) : a.estado === 'abierta' ? -1 : 1));
}

export function evaluarExcepciones(hoy = new Date()): ResultadoExcepciones {
  const cfg = configEfectivaDemo().excepciones;
  const candidatas: Pick<Excepcion, 'tipo' | 'clave' | 'severidad' | 'titulo' | 'detalle'>[] = [];
  for (const f of riesgo().filas.filter((x) => x.semaforo === 'rojo')) {
    candidatas.push({ tipo: 'sku_en_rojo', clave: f.sku, severidad: 'alta', titulo: `SKU ${f.sku} en rojo`, detalle: f.motivo });
  }
  for (const oc of db.purchaseOrders.filter((o) => VIGENTES.includes(o.estado) && o.fechaRequerida && new Date(o.fechaRequerida) < hoy)) {
    const dias = Math.floor((hoy.getTime() - new Date(oc.fechaRequerida as string).getTime()) / DIA);
    candidatas.push({
      tipo: 'oc_atrasada',
      clave: oc.id,
      severidad: dias > 7 ? 'alta' : 'media',
      titulo: `OC ${oc.numero} atrasada`,
      detalle: `La OC ${oc.numero} de ${oc.proveedor?.nombre ?? 'su proveedor'} debía llegar hace ${dias} día${dias === 1 ? '' : 's'} y sigue sin recibirse completa.`,
    });
  }

  const r: ResultadoExcepciones = { abiertas: 0, resueltas: 0, escaladas: 0 };
  const claves = new Set(candidatas.map((c) => `${c.tipo}:${c.clave}`));
  for (const c of casos.values()) {
    if (c.estado === 'abierta' && !claves.has(`${c.tipo}:${c.clave}`)) {
      c.estado = 'resuelta';
      c.resueltaAt = hoy.toISOString();
      r.resueltas++;
    }
  }
  for (const c of candidatas) {
    const k = `${c.tipo}:${c.clave}`;
    const previo = casos.get(k);
    if (previo?.estado === 'abierta') continue;
    const horas = c.severidad === 'media' ? cfg.slaMediaHoras : cfg.slaAltaHoras;
    casos.set(k, {
      ...c,
      id: previo?.id ?? `x-${++contador}`,
      estado: 'abierta',
      taskId: null,
      venceSlaAt: new Date(hoy.getTime() + horas * HORA).toISOString(),
      escaladaAt: null,
      resueltaAt: null,
      createdAt: previo?.createdAt ?? hoy.toISOString(),
    });
    r.abiertas++;
  }
  for (const c of casos.values()) {
    if (c.estado === 'abierta' && !c.escaladaAt && new Date(c.venceSlaAt) < hoy) {
      c.escaladaAt = hoy.toISOString();
      c.severidad = 'critica';
      r.escaladas++;
    }
  }
  return r;
}
