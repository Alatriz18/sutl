import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';
import { auth, crearTenantConAdmin, ENVIO_BASE, loginAs, PASSWORD } from './test-helpers';

// Seguimiento público con la marca de cada empresa: se configura en Configuración, la ve el
// destinatario sin iniciar sesión, y la ruta pública no filtra datos internos.
describe('Seguimiento público con marca (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const limiteLoginOriginal = process.env.LOGIN_RATE_LIMIT;
  let a: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let b: Awaited<ReturnType<typeof crearTenantConAdmin>>;
  let guiaA: string;
  let guiaB: string;
  const http = () => request(app.getHttpServer());
  const marca = (token: string, m: Record<string, unknown>) => http().patch('/api/tenant-config').set(auth(token)).send({ configuracion: { marca: m } });
  const publico = (guia: string) => http().get(`/api/shipments/tracking/${guia}`);

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT = '1000';
    app = await createTestApp();
    a = await crearTenantConAdmin(app, `Marca A ${suffix}`);
    b = await crearTenantConAdmin(app, `Marca B ${suffix}`);
    const ea = await http().post('/api/shipments').set(auth(a.token)).send({ ...ENVIO_BASE });
    const eb = await http().post('/api/shipments').set(auth(b.token)).send({ ...ENVIO_BASE });
    guiaA = ea.body.codigoGuia;
    guiaB = eb.body.codigoGuia;
    await http().post('/api/tracking-events').set(auth(a.token)).send({ shipmentId: ea.body.id, estado: 'en_transito', ubicacion: 'Puerto', descripcion: 'Zarpó' });
  });

  afterAll(async () => {
    process.env.LOGIN_RATE_LIMIT = limiteLoginOriginal;
    await app.close();
  });

  it('sin configurar usa el nombre de la empresa y los valores por defecto', async () => {
    const r = await publico(guiaA);
    expect(r.status).toBe(200);
    expect(r.body.marca).toEqual({ nombre: `Marca A ${suffix}`, colorPrimario: null, logoUrl: null, mensaje: null, mostrarSutl: true });
  });

  it('la marca configurada aparece en la página pública, solo en los envíos de esa empresa', async () => {
    const cfg = { nombreComercial: 'Transportes Andes', colorPrimario: '#1A7A4C', logoUrl: 'https://cdn.andes.com/logo.png', mensaje: 'Gracias por confiar en nosotros', mostrarSutl: false };
    expect((await marca(a.token, cfg)).status).toBe(200);
    expect((await publico(guiaA)).body.marca).toEqual({ nombre: 'Transportes Andes', colorPrimario: '#1A7A4C', logoUrl: 'https://cdn.andes.com/logo.png', mensaje: 'Gracias por confiar en nosotros', mostrarSutl: false });
    // La otra empresa no hereda nada.
    expect((await publico(guiaB)).body.marca).toEqual({ nombre: `Marca B ${suffix}`, colorPrimario: null, logoUrl: null, mensaje: null, mostrarSutl: true });
  });

  it('rechaza colores, logos y textos mal formados al guardar', async () => {
    for (const mal of [{ colorPrimario: 'rojo' }, { colorPrimario: '#12345' }, { logoUrl: 'http://x.com/a.png' }, { logoUrl: 'javascript:alert(1)' }, { logoUrl: 'https://x.com/a b.png' }, { nombreComercial: 'x'.repeat(61) }, { mensaje: 'y'.repeat(281) }]) {
      const r = await marca(a.token, mal);
      expect([JSON.stringify(mal), r.status]).toEqual([JSON.stringify(mal), 400]);
    }
  });

  it('vaciar un campo vuelve al valor por defecto', async () => {
    expect((await marca(a.token, { colorPrimario: '', logoUrl: '' })).status).toBe(200);
    const r = await publico(guiaA);
    expect(r.body.marca.colorPrimario).toBeNull();
    expect(r.body.marca.logoUrl).toBeNull();
  });

  it('solo un administrador cambia la marca; un operador no', async () => {
    const email = `marca-op-${suffix}@e2e-test.com`;
    expect((await http().post('/api/users').set(auth(a.token)).send({ email, password: PASSWORD, nombre: 'Operador', rol: 'operador' })).status).toBe(201);
    const operador = await loginAs(app, email);
    expect((await marca(operador, { colorPrimario: '#112233' })).status).toBe(403);
    expect((await http().get('/api/tenant-config').set(auth(operador))).status).toBe(200);
  });

  it('la ruta pública no filtra datos internos de los eventos', async () => {
    const r = await publico(guiaA);
    expect(r.body.eventos.length).toBeGreaterThanOrEqual(1);
    for (const ev of r.body.eventos) {
      expect(Object.keys(ev).sort()).toEqual(['_id', 'descripcion', 'estado', 'timestamp', 'ubicacion']);
      expect(ev).not.toHaveProperty('responsable');
      expect(ev).not.toHaveProperty('tenantId');
    }
    expect(JSON.stringify(r.body)).not.toContain('@e2e-test.com');
  });

  it('un código inexistente responde 404', async () => {
    expect((await publico('NO-EXISTE-123')).status).toBe(404);
  });
});
