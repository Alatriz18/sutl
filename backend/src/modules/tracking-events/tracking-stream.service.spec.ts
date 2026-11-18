import { firstValueFrom, take, toArray } from 'rxjs';
import { EventoEnVivo, TrackingStreamService } from './tracking-stream.service';

const ev = (shipmentId: string, tenantId = 't1'): EventoEnVivo => ({
  tenantId,
  shipmentId,
  codigoGuia: `G-${shipmentId}`,
  evento: { _id: 'e1', estado: 'en_transito', timestamp: new Date('2026-01-01') },
});

describe('TrackingStreamService', () => {
  it('entrega solo los eventos que cumplen el filtro y con la forma proyectada', async () => {
    const s = new TrackingStreamService();
    const recibidos = firstValueFrom(s.suscribir((e) => e.shipmentId === 'a', (e) => ({ id: e.evento._id }), 10_000).pipe(take(1)));
    s.publicar(ev('b'));
    s.publicar(ev('a'));
    expect(await recibidos).toEqual({ type: 'evento', data: { id: 'e1' } });
  });

  it('cuenta las conexiones abiertas y las descuenta al cerrarse', () => {
    const s = new TrackingStreamService();
    expect(s.conexionesAbiertas).toBe(0);
    const sub1 = s.suscribir(() => true, () => ({}), 10_000).subscribe();
    const sub2 = s.suscribir(() => true, () => ({}), 10_000).subscribe();
    expect(s.conexionesAbiertas).toBe(2);
    sub1.unsubscribe();
    expect(s.conexionesAbiertas).toBe(1);
    sub2.unsubscribe();
    expect(s.conexionesAbiertas).toBe(0);
  });

  it('no cuenta una conexión que nunca se abre', () => {
    const s = new TrackingStreamService();
    s.suscribir(() => true, () => ({}));
    expect(s.conexionesAbiertas).toBe(0);
  });

  it('manda latidos para mantener viva la conexión', async () => {
    const s = new TrackingStreamService();
    const latidos = await firstValueFrom(s.suscribir(() => false, () => ({}), 5).pipe(take(2), toArray()));
    expect(latidos).toEqual([{ type: 'ping', data: {} }, { type: 'ping', data: {} }]);
  });

  it('avisa cuando no hay cupo', () => {
    const s = new TrackingStreamService();
    expect(s.hayCupo()).toBe(true);
  });

  describe('difusión entre réplicas (mensajes de Redis)', () => {
    it('reparte un mensaje válido, devolviendo la fecha como Date', async () => {
      const s = new TrackingStreamService();
      const recibido = firstValueFrom(s.suscribir(() => true, (e) => ({ ts: e.evento.timestamp instanceof Date }), 10_000).pipe(take(1)));
      s.recibirDeRedis(JSON.stringify(ev('a')));
      expect(await recibido).toEqual({ type: 'evento', data: { ts: true } });
    });

    it('ignora mensajes mal formados o incompletos sin romper', () => {
      const s = new TrackingStreamService();
      const vistos: unknown[] = [];
      const sub = s.suscribir(() => true, (e) => ({ id: e.evento._id }), 10_000).subscribe((m) => vistos.push(m));
      for (const malo of ['no es json', '{}', 'null', JSON.stringify({ tenantId: 't1' }), JSON.stringify({ tenantId: 't1', shipmentId: 's', codigoGuia: 'g' })]) s.recibirDeRedis(malo);
      sub.unsubscribe();
      expect(vistos).toEqual([]);
    });

    it('no entrega dos veces el mismo evento (en memoria y por Redis)', () => {
      const s = new TrackingStreamService();
      const vistos: unknown[] = [];
      const sub = s.suscribir(() => true, (e) => ({ id: e.evento._id }), 10_000).subscribe((m) => vistos.push(m));
      s.publicar(ev('a')); // sin Redis: memoria
      s.recibirDeRedis(JSON.stringify(ev('a'))); // la misma, llegando por Redis
      sub.unsubscribe();
      expect(vistos).toHaveLength(1);
    });

    it('eventos distintos de un mismo envío sí se entregan todos', () => {
      const s = new TrackingStreamService();
      const vistos: unknown[] = [];
      const sub = s.suscribir(() => true, (e) => ({ id: e.evento._id }), 10_000).subscribe((m) => vistos.push(m));
      s.publicar({ ...ev('a'), evento: { ...ev('a').evento, _id: 'x1' } });
      s.publicar({ ...ev('a'), evento: { ...ev('a').evento, _id: 'x2' } });
      sub.unsubscribe();
      expect(vistos).toHaveLength(2);
    });
  });
});
