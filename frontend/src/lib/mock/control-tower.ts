import { ControlTowerResumen, Tarea, User } from '@/types';
import * as db from './data';
import { evaluarExcepciones, listarExcepciones } from './exceptions';
import { riesgo } from './supply';
import { manejarTareas } from './tasks';

// Tablero de la torre de control del modo demo: mismas reglas que
// backend/src/modules/control-tower (vigentes, ventana de 7 días, solo mis tareas).

const DIA = 86_400_000;
const VIGENTES = ['emitida', 'confirmada', 'despachada', 'recibida_parcial'];
const TOP = 5;

export function resumenTorre(usuario: User, hoy = new Date(), ventanaDias = 7): ControlTowerResumen {
  const hasta = new Date(hoy.getTime() + ventanaDias * DIA);
  const finDelDia = new Date(hoy);
  finDelDia.setHours(23, 59, 59, 999);
  const r = riesgo();

  const ocs = db.purchaseOrders.filter((o) => o.tenantId === usuario.tenantId && VIGENTES.includes(o.estado) && o.fechaRequerida);
  const atrasadas = ocs.filter((o) => new Date(o.fechaRequerida as string) < hoy).sort((a, b) => (a.fechaRequerida as string).localeCompare(b.fechaRequerida as string));
  const porVencer = ocs
    .filter((o) => {
      const f = new Date(o.fechaRequerida as string);
      return f >= hoy && f <= hasta;
    })
    .sort((a, b) => (a.fechaRequerida as string).localeCompare(b.fechaRequerida as string));
  const porLlegar = db.shipments
    .filter((s) => s.tenantId === usuario.tenantId && s.estado !== 'entregado' && s.fechaEstimadaLlegada && new Date(s.fechaEstimadaLlegada) >= hoy && new Date(s.fechaEstimadaLlegada) <= hasta)
    .sort((a, b) => (a.fechaEstimadaLlegada as string).localeCompare(b.fechaEstimadaLlegada as string));

  if (listarExcepciones().length === 0) evaluarExcepciones();
  const abiertas = listarExcepciones('abierta');
  const cuenta = (s: string) => abiertas.filter((e) => e.severidad === s).length;

  const tareas = (manejarTareas('get', '/tasks', { mias: 'true' }, {}, usuario, db.users)?.data ?? []) as Tarea[];
  const todas = (manejarTareas('get', '/tasks', {}, {}, usuario, db.users)?.data ?? []) as Tarea[];
  const abierta = (t: Tarea) => t.estado === 'abierta' || t.estado === 'en_curso';

  return {
    generadoAt: hoy.toISOString(),
    ventanaDias,
    riesgo: {
      evaluadoAt: r.evaluadoAt,
      resumen: r.resumen,
      criticos: r.filas
        .filter((f) => f.semaforo === 'rojo' || f.semaforo === 'amarillo')
        .slice(0, TOP)
        .map((f) => ({ sku: f.sku, descripcion: f.descripcion, semaforo: f.semaforo, accion: f.accion, motivo: f.motivo, fechaQuiebre: f.fechaQuiebre, diasSinStock: f.diasSinStock })),
    },
    ocsAtrasadas: {
      total: atrasadas.length,
      items: atrasadas.slice(0, TOP).map((o) => ({
        id: o.id,
        numero: o.numero,
        proveedor: o.proveedor?.nombre ?? '—',
        fechaRequerida: o.fechaRequerida as string,
        diasAtraso: Math.floor((hoy.getTime() - new Date(o.fechaRequerida as string).getTime()) / DIA),
      })),
    },
    vencimientos: {
      ocs: { total: porVencer.length, items: porVencer.slice(0, TOP).map((o) => ({ id: o.id, numero: o.numero, proveedor: o.proveedor?.nombre ?? '—', fechaRequerida: o.fechaRequerida as string })) },
      embarques: {
        total: porLlegar.length,
        items: porLlegar.slice(0, TOP).map((s) => ({ id: s.id, codigoGuia: s.codigoGuia, destino: s.destino, estado: s.estado, fechaEstimadaLlegada: s.fechaEstimadaLlegada as string })),
      },
    },
    excepciones: { abiertas: abiertas.length, criticas: cuenta('critica'), altas: cuenta('alta'), medias: cuenta('media') },
    tareas: {
      vencidasEmpresa: todas.filter((t) => abierta(t) && t.fechaLimite && new Date(t.fechaLimite) < hoy).length,
      misTareasHoy: tareas
        .filter((t) => abierta(t) && t.fechaLimite && new Date(t.fechaLimite) <= finDelDia)
        .slice(0, 8)
        .map((t) => ({ id: t.id, titulo: t.titulo, prioridad: t.prioridad, fechaLimite: t.fechaLimite, entidadTipo: t.entidadTipo, entidadId: t.entidadId })),
    },
  };
}
