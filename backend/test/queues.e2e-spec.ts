import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, superAdminToken } from './test-helpers';
import { COLA_MANTENIMIENTO, TRABAJO_LATIDO } from '../src/modules/queues/queues.constants';
import { QueuesService } from '../src/modules/queues/queues.service';

describe('Colas de trabajo (BullMQ + Redis)', () => {
  let app: INestApplication;
  let cola: Queue;

  beforeAll(async () => {
    app = await createTestApp();
    cola = app.get<Queue>(getQueueToken(COLA_MANTENIMIENTO));
  });

  afterAll(async () => {
    await cola.obliterate({ force: true });
    await app.close();
  });

  it('REDIS_URL está configurada en el entorno de pruebas', () => {
    expect(process.env.REDIS_URL).toBeTruthy();
  });

  it('un trabajo encolado lo procesa el worker y queda completado', async () => {
    const job = await cola.add(TRABAJO_LATIDO, {});
    const fin = await esperarCompletado(job.id as string);
    expect(fin.ejecutadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('un trabajo desconocido falla y queda registrado, no se descarta', async () => {
    const job = await cola.add('inexistente', {}, { attempts: 1 });
    const estado = await esperarEstado(job.id as string, 'failed');
    expect(estado).toBe('failed');
  });

  it('encolar exige tenantId', async () => {
    const svc = app.get(QueuesService);
    await expect(svc.encolar('x', { tenantId: '' })).rejects.toThrow(/tenantId/);
  });

  describe('GET /queues/estado', () => {
    it('lo ve el super_admin', async () => {
      const sa = await superAdminToken(app);
      const res = await request(app.getHttpServer()).get('/api/queues/estado').set(auth(sa));
      expect(res.status).toBe(200);
      expect(res.body.habilitado).toBe(true);
      expect(res.body.cola).toBe(COLA_MANTENIMIENTO);
      expect(res.body.conteos).toHaveProperty('completed');
    });

    it('un admin de empresa recibe 403', async () => {
      const t = await crearTenantConAdmin(app, `Colas${Date.now()}`);
      const res = await request(app.getHttpServer()).get('/api/queues/estado').set(auth(t.token));
      expect(res.status).toBe(403);
    });

    it('sin token recibe 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/queues/estado');
      expect(res.status).toBe(401);
    });
  });

  async function esperarCompletado(id: string) {
    for (let i = 0; i < 100; i++) {
      const j = await cola.getJob(id);
      if (j && (await j.isCompleted())) return j.returnvalue;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('El trabajo no se completó en 10 s');
  }

  async function esperarEstado(id: string, esperado: string) {
    for (let i = 0; i < 100; i++) {
      const estado = await (await cola.getJob(id))?.getState();
      if (estado === esperado) return estado;
      await new Promise((r) => setTimeout(r, 100));
    }
    return 'timeout';
  }
});
