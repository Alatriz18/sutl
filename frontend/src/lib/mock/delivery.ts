import type { PruebaEntrega, ResultadoRegistroPod } from '@/types/entrega';
import { User } from '@/types';
import * as db from './data';
import { MockApiError } from './errors';

// Prueba de entrega del modo demo (en memoria): la entrega deja el envío «entregado» y un evento en el
// seguimiento. La recepción de órdenes de compra por POD la prueba el backend real; aquí no se simula.

const pods = new Map<string, PruebaEntrega>();
let contador = 0;

export function obtenerPod(shipmentId: string): PruebaEntrega | Record<string, never> {
  if (!db.shipments.some((s) => s.id === shipmentId)) throw new MockApiError(404, 'Envío no encontrado');
  return pods.get(shipmentId) ?? {};
}

export function registrarPod(user: User, shipmentId: string, form: FormData): ResultadoRegistroPod {
  const envio = db.shipments.find((s) => s.id === shipmentId && s.tenantId === user.tenantId);
  if (!envio) throw new MockApiError(404, 'Envío no encontrado');
  if (user.rol === 'cliente_final') throw new MockApiError(403, 'Forbidden resource');
  const receptorNombre = String(form.get('receptorNombre') ?? '').trim();
  if (!receptorNombre) throw new MockApiError(400, 'Indica quién recibió');
  if (pods.has(shipmentId)) throw new MockApiError(409, 'Este envío ya tiene su prueba de entrega');
  const cuando = form.get('entregadoAt') ? new Date(String(form.get('entregadoAt'))) : new Date();
  if (cuando.getTime() > Date.now() + 86_400_000) throw new MockApiError(400, 'La fecha de entrega no puede estar en el futuro');
  const archivo = form.get('evidencia') as File | null;

  const pod: PruebaEntrega = {
    id: `pod-${++contador}`,
    receptorNombre,
    receptorDocumento: String(form.get('receptorDocumento') ?? '').trim() || null,
    entregadoAt: cuando.toISOString(),
    observaciones: String(form.get('observaciones') ?? '').trim() || null,
    archivoNombre: archivo?.name ?? null,
    tieneArchivo: !!archivo,
    createdAt: new Date().toISOString(),
    registradoPor: { nombre: user.nombre },
  };
  pods.set(shipmentId, pod);

  envio.estado = 'entregado';
  db.trackingEventsByShipment[shipmentId] = [
    ...(db.trackingEventsByShipment[shipmentId] ?? []),
    {
      _id: `ev-pod-${contador}`, shipmentId, tenantId: envio.tenantId, codigoGuia: envio.codigoGuia, estado: 'entregado',
      ubicacion: envio.destino, descripcion: `Entregado a ${receptorNombre}`, responsable: user.email, timestamp: cuando.toISOString(),
    },
  ];
  return { pod, recepciones: [] };
}
