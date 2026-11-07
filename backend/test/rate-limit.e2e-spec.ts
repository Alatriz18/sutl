import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// El límite de intentos de login es la defensa anti fuerza bruta: debe
// responder 429 al pasarse y respetar el valor configurado por entorno.
describe('Límite de intentos de login', () => {
  let app: INestApplication;
  const original = process.env.LOGIN_RATE_LIMIT;

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '3';
    app = await createTestApp();
  });

  afterAll(async () => {
    if (original === undefined) delete process.env.LOGIN_RATE_LIMIT;
    else process.env.LOGIN_RATE_LIMIT = original;
    await app.close();
  });

  it('tras 3 intentos en un minuto, el cuarto recibe 429', async () => {
    const intento = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nadie@e2e-test.com', password: 'incorrecta-123' });
    for (let i = 0; i < 3; i++) expect((await intento()).status).toBe(401);
    expect((await intento()).status).toBe(429);
  });
});
