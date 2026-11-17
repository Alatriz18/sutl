import { Injectable } from '@nestjs/common';
import { Observable, Subject, defer, filter, finalize, interval, map, merge } from 'rxjs';

export interface EventoEnVivo {
  tenantId: string;
  shipmentId: string;
  codigoGuia: string;
  evento: {
    _id: string;
    estado: string;
    ubicacion?: string;
    descripcion?: string;
    lat?: number;
    lng?: number;
    timestamp: Date;
  };
}

export interface MensajeSse {
  type: 'evento' | 'ping';
  data: Record<string, unknown>;
}

// Máximo de conexiones abiertas a la vez en este proceso: protege al servidor de abrir miles de
// conexiones en la ruta pública. Al pasarlo, quien intenta conectar recibe el aviso y reintenta.
export const MAX_CONEXIONES = 500;
const LATIDO_MS = 25_000;

// Tiempo real sin dependencias nuevas: los eventos que se registran se publican en memoria y las
// conexiones SSE abiertas los reciben al instante. Es por proceso: con varias réplicas del backend
// habría que llevarlo a Redis (pub/sub), que ya forma parte del stack.
@Injectable()
export class TrackingStreamService {
  private readonly bus = new Subject<EventoEnVivo>();
  private abiertas = 0;

  publicar(e: EventoEnVivo) {
    this.bus.next(e);
  }

  get conexionesAbiertas() {
    return this.abiertas;
  }

  hayCupo() {
    return this.abiertas < MAX_CONEXIONES;
  }

  // `proyectar` decide qué ve cada audiencia (la pública no recibe datos internos).
  suscribir(donde: (e: EventoEnVivo) => boolean, proyectar: (e: EventoEnVivo) => Record<string, unknown>, latidoMs = LATIDO_MS): Observable<MensajeSse> {
    const eventos = this.bus.pipe(filter(donde), map((e): MensajeSse => ({ type: 'evento', data: proyectar(e) })));
    // El latido mantiene viva la conexión a través de proxies y deja detectar cortes.
    const latido = interval(latidoMs).pipe(map((): MensajeSse => ({ type: 'ping', data: {} })));
    // Se cuenta al suscribirse (no al crear el observable) y se descuenta siempre al cerrarse.
    return defer(() => {
      this.abiertas++;
      return merge(eventos, latido).pipe(finalize(() => void this.abiertas--));
    });
  }
}
