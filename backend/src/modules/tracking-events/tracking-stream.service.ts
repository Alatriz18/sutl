import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
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

// Canal de Redis por el que se difunden los eventos entre réplicas. Las pruebas usan otro prefijo por worker
// de Jest para no mezclar sus eventos con los del entorno de desarrollo (igual que las colas).
const canal = () => `${process.env.NODE_ENV === 'test' ? `sutl-test-${process.env.JEST_WORKER_ID ?? '0'}` : 'sutl'}:tracking-en-vivo`;
const MAX_VISTOS = 2000;

// Tiempo real sin dependencias nuevas: los eventos que se registran se publican y las conexiones SSE abiertas los
// reciben al instante. Con REDIS_URL se difunden por Redis (pub/sub, que ya forma parte del stack) para que una
// conexión abierta en una réplica reciba los eventos registrados en cualquier otra. Sin Redis, o mientras la
// conexión a Redis no esté lista, se entrega en memoria de este proceso (funciona igual con una sola réplica).
@Injectable()
export class TrackingStreamService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TrackingStreamService.name);
  private readonly bus = new Subject<EventoEnVivo>();
  private abiertas = 0;
  private pub?: Redis;
  private sub?: Redis;
  private subListo = false;
  // Evita entregar dos veces un mismo evento (p. ej. si llega por Redis y también se entregó en memoria).
  private readonly vistos = new Set<string>();

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) return;
    try {
      this.pub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false });
      this.sub = new Redis(url, { maxRetriesPerRequest: null });
      // Un fallo de Redis nunca tumba la API: se registra y se sigue en memoria.
      this.pub.on('error', (e) => this.logger.warn(`Redis (publicación): ${e.message}`));
      this.sub.on('error', (e) => this.logger.warn(`Redis (suscripción): ${e.message}`));
      this.sub.on('ready', () => {
        this.sub?.subscribe(canal()).then(() => (this.subListo = true)).catch((e) => this.logger.warn(`No se pudo suscribir a Redis: ${e.message}`));
      });
      this.sub.on('end', () => (this.subListo = false));
      this.sub.on('close', () => (this.subListo = false));
      this.sub.on('message', (_c, mensaje) => this.recibirDeRedis(mensaje));
    } catch (e) {
      this.logger.warn(`Sin difusión por Redis (se usa memoria): ${(e as Error).message}`);
    }
  }

  async onApplicationShutdown() {
    this.subListo = false;
    await Promise.allSettled([this.pub?.quit(), this.sub?.quit()]);
  }

  publicar(e: EventoEnVivo) {
    if (this.pub && this.subListo) {
      // Con Redis sano, la entrega (también a este proceso) llega por la suscripción.
      this.pub.publish(canal(), JSON.stringify(e)).catch((err) => {
        this.logger.warn(`No se pudo difundir por Redis, se entrega en memoria: ${err.message}`);
        this.entregar(e);
      });
      return;
    }
    // Sin Redis (o aún sin conexión): memoria local, y si hay Redis se avisa a las demás réplicas.
    this.entregar(e);
    this.pub?.publish(canal(), JSON.stringify(e)).catch(() => undefined);
  }

  // Un mensaje de Redis es de confianza (canal interno), pero se valida su forma antes de repartirlo.
  recibirDeRedis(mensaje: string) {
    let e: EventoEnVivo;
    try {
      e = JSON.parse(mensaje) as EventoEnVivo;
    } catch {
      return;
    }
    if (typeof e?.tenantId !== 'string' || typeof e?.shipmentId !== 'string' || typeof e?.codigoGuia !== 'string' || typeof e?.evento?._id !== 'string') return;
    e.evento.timestamp = new Date(e.evento.timestamp);
    this.entregar(e);
  }

  private entregar(e: EventoEnVivo) {
    const clave = `${e.tenantId}:${e.shipmentId}:${e.evento._id}`;
    if (this.vistos.has(clave)) return;
    this.vistos.add(clave);
    if (this.vistos.size > MAX_VISTOS) this.vistos.delete(this.vistos.values().next().value as string);
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
