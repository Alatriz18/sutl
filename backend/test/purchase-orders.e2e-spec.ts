import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-app';

// Control de OCs contra Postgres real: ciclo de vida completo (borrador →
// emitida → confirmada → despachada → recepciones), reglas de negocio y
// aislamiento multi-tenant (B no ve, no modifica ni recibe la OC de A, y no
// puede usar como proveedor un partner de A).
const SUPER_ADMIN = { email: 'admin@sutl.dev', password: 'SutlAdmin2026!' };
const PASSWORD = 'PasswordSeguro123';

describe('Control de Órdenes de Compra (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();

  let tokenA: string;
  let tokenB: string;
  let tokenClienteFinalA: string;
  let proveedorAId: string;
  let clienteAId: string;
  let ocId: string;
  let lineaResinaId: string;
  let lineaPigmentoId: string;

  const http = () => request(app.getHttpServer());

  async function login(email: string, password: string) {
    const res = await http().post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  async function crearTenantConUsuario(superAdminToken: string, nombre: string, email: string) {
    const tenant = await http()
      .post('/api/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ nombre, plan: 'trial' });
    expect(tenant.status).toBe(201);
    const user = await http()
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ tenantId: tenant.body.id, email, password: PASSWORD, nombre });
    expect(user.status).toBe(201);
    return login(email, PASSWORD);
  }

  function crearOc(token: string, body: Record<string, unknown>) {
    return http().post('/api/purchase-orders').set('Authorization', `Bearer ${token}`).send(body);
  }

  beforeAll(async () => {
    app = await createTestApp();
    const superAdminToken = await login(SUPER_ADMIN.email, SUPER_ADMIN.password);

    tokenA = await crearTenantConUsuario(superAdminToken, `Tenant OC A ${suffix}`, `oc-a-${suffix}@oc-test.com`);
    tokenB = await crearTenantConUsuario(superAdminToken, `Tenant OC B ${suffix}`, `oc-b-${suffix}@oc-test.com`);

    // Rol cliente_final dentro del tenant A: no debe tener acceso a compras.
    const clienteFinal = await http()
      .post('/api/users')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: `oc-cf-${suffix}@oc-test.com`, password: PASSWORD, nombre: 'Cliente final', rol: 'cliente_final' });
    // super_admin crea usuarios en su propio tenant (SVK), suficiente para probar el rol.
    expect(clienteFinal.status).toBe(201);
    tokenClienteFinalA = await login(`oc-cf-${suffix}@oc-test.com`, PASSWORD);

    const proveedor = await http()
      .post('/api/partners')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'proveedor', nombre: `Resinas del Pacífico ${suffix}` });
    expect(proveedor.status).toBe(201);
    proveedorAId = proveedor.body.id;

    const cliente = await http()
      .post('/api/partners')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tipo: 'cliente', nombre: `Cliente no proveedor ${suffix}` });
    expect(cliente.status).toBe(201);
    clienteAId = cliente.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('creación y validación', () => {
    it('crea una OC en borrador con sus líneas', async () => {
      const res = await crearOc(tokenA, {
        numero: `OC-${suffix}`,
        proveedorId: proveedorAId,
        incoterm: 'FOB',
        moneda: 'usd',
        fechaRequerida: new Date(Date.now() + 30 * 86400000).toISOString(),
        lineas: [
          { sku: 'RES-PET-01', descripcion: 'Resina PET grado botella', cantidad: 2000, unidad: 'kg', precioUnitario: 1.35 },
          { sku: 'PIG-AZ-02', descripcion: 'Pigmento azul', cantidad: 50, unidad: 'kg' },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('borrador');
      expect(res.body.moneda).toBe('USD');
      expect(res.body.lineas).toHaveLength(2);
      ocId = res.body.id;
      lineaResinaId = res.body.lineas.find((l: { sku: string }) => l.sku === 'RES-PET-01').id;
      lineaPigmentoId = res.body.lineas.find((l: { sku: string }) => l.sku === 'PIG-AZ-02').id;
    });

    it('rechaza número de OC duplicado en el mismo tenant (409)', async () => {
      const res = await crearOc(tokenA, {
        numero: `OC-${suffix}`,
        proveedorId: proveedorAId,
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      expect(res.status).toBe(409);
    });

    it('rechaza una OC sin líneas o con cantidad no positiva', async () => {
      const sinLineas = await crearOc(tokenA, { numero: `OC-VACIA-${suffix}`, proveedorId: proveedorAId, lineas: [] });
      expect(sinLineas.status).toBe(400);
      const cantidadCero = await crearOc(tokenA, {
        numero: `OC-CERO-${suffix}`,
        proveedorId: proveedorAId,
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 0 }],
      });
      expect(cantidadCero.status).toBe(400);
    });

    it('rechaza un partner que no es de tipo proveedor', async () => {
      const res = await crearOc(tokenA, {
        numero: `OC-CLI-${suffix}`,
        proveedorId: clienteAId,
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      expect(res.status).toBe(400);
    });

    it('rechaza incoterm inválido y campos no permitidos (ej. forzar estado)', async () => {
      const incoterm = await crearOc(tokenA, {
        numero: `OC-INC-${suffix}`,
        proveedorId: proveedorAId,
        incoterm: 'XYZ',
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      expect(incoterm.status).toBe(400);
      const estado = await crearOc(tokenA, {
        numero: `OC-EST-${suffix}`,
        proveedorId: proveedorAId,
        estado: 'recibida',
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      expect(estado.status).toBe(400);
    });

    it('lista y filtra por estado y por SKU', async () => {
      const porEstado = await http()
        .get('/api/purchase-orders?estado=borrador')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(porEstado.status).toBe(200);
      expect(porEstado.body.map((o: { id: string }) => o.id)).toContain(ocId);

      const porSku = await http().get('/api/purchase-orders?q=pig-az').set('Authorization', `Bearer ${tokenA}`);
      expect(porSku.body.map((o: { id: string }) => o.id)).toContain(ocId);

      // El listado trae lo necesario para calcular avance y total sin pedir el detalle.
      const enLista = porEstado.body.find((o: { id: string }) => o.id === ocId);
      for (const linea of enLista.lineas) {
        expect(linea).toHaveProperty('cantidad');
        expect(linea).toHaveProperty('cantidadRecibida');
        expect(linea).toHaveProperty('precioUnitario');
      }
    });
  });

  describe('ciclo de vida', () => {
    it('no permite recibir mercadería de una OC en borrador', async () => {
      const res = await http()
        .post(`/api/purchase-orders/${ocId}/recepciones`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lineas: [{ lineaId: lineaResinaId, cantidad: 10 }] });
      expect(res.status).toBe(400);
    });

    it('no permite saltar de borrador a despachada', async () => {
      const res = await http()
        .post(`/api/purchase-orders/${ocId}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'despachada' });
      expect(res.status).toBe(400);
    });

    it('en borrador se pueden reemplazar las líneas', async () => {
      const res = await http()
        .patch(`/api/purchase-orders/${ocId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          lineas: [
            { sku: 'RES-PET-01', descripcion: 'Resina PET grado botella', cantidad: 1000, unidad: 'kg' },
            { sku: 'PIG-AZ-02', descripcion: 'Pigmento azul', cantidad: 50, unidad: 'kg' },
          ],
        });
      expect(res.status).toBe(200);
      lineaResinaId = res.body.lineas.find((l: { sku: string }) => l.sku === 'RES-PET-01').id;
      lineaPigmentoId = res.body.lineas.find((l: { sku: string }) => l.sku === 'PIG-AZ-02').id;
      expect(res.body.lineas.find((l: { sku: string }) => l.sku === 'RES-PET-01').cantidad).toBe(1000);
    });

    it('emite la OC; después ya no se pueden cambiar las líneas', async () => {
      const emitir = await http()
        .post(`/api/purchase-orders/${ocId}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'emitida' });
      expect(emitir.status).toBe(201);
      expect(emitir.body.estado).toBe('emitida');

      const editar = await http()
        .patch(`/api/purchase-orders/${ocId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }] });
      expect(editar.status).toBe(400);
    });

    it('confirmar exige fecha del proveedor; con fecha pasa a confirmada', async () => {
      const sinFecha = await http()
        .post(`/api/purchase-orders/${ocId}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'confirmada' });
      expect(sinFecha.status).toBe(400);

      const fecha = new Date(Date.now() + 10 * 86400000).toISOString();
      const conFecha = await http()
        .post(`/api/purchase-orders/${ocId}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'confirmada', fechaConfirmadaProveedor: fecha });
      expect(conFecha.status).toBe(201);
      expect(conFecha.body.estado).toBe('confirmada');
      expect(new Date(conFecha.body.fechaConfirmadaProveedor).toISOString()).toBe(fecha);
    });

    it('despacha la OC y registra la fecha de despacho', async () => {
      const res = await http()
        .post(`/api/purchase-orders/${ocId}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'despachada' });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('despachada');
      expect(res.body.fechaDespacho).toBeTruthy();
    });

    it('una recepción parcial deja la OC en recibida_parcial y queda en el historial', async () => {
      const res = await http()
        .post(`/api/purchase-orders/${ocId}/recepciones`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lineas: [{ lineaId: lineaResinaId, cantidad: 600 }], notas: 'Primer contenedor' });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('recibida_parcial');
      const resina = res.body.lineas.find((l: { id: string }) => l.id === lineaResinaId);
      expect(resina.cantidadRecibida).toBe(600);
      expect(resina.recepciones).toHaveLength(1);
    });

    it('rechaza recibir más de lo pendiente y no altera lo ya recibido', async () => {
      const res = await http()
        .post(`/api/purchase-orders/${ocId}/recepciones`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ lineas: [{ lineaId: lineaResinaId, cantidad: 401 }] });
      expect(res.status).toBe(400);

      const oc = await http().get(`/api/purchase-orders/${ocId}`).set('Authorization', `Bearer ${tokenA}`);
      expect(oc.body.lineas.find((l: { id: string }) => l.id === lineaResinaId).cantidadRecibida).toBe(600);
    });

    it('si una línea del lote falla, no se guarda ninguna (transacción)', async () => {
      const res = await http()
        .post(`/api/purchase-orders/${ocId}/recepciones`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          lineas: [
            { lineaId: lineaPigmentoId, cantidad: 10 },
            { lineaId: lineaResinaId, cantidad: 9999 },
          ],
        });
      expect(res.status).toBe(400);
      const oc = await http().get(`/api/purchase-orders/${ocId}`).set('Authorization', `Bearer ${tokenA}`);
      expect(oc.body.lineas.find((l: { id: string }) => l.id === lineaPigmentoId).cantidadRecibida).toBe(0);
    });

    it('recibir lo pendiente cierra la OC como recibida; ya no se puede cancelar ni editar', async () => {
      const res = await http()
        .post(`/api/purchase-orders/${ocId}/recepciones`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          lineas: [
            { lineaId: lineaResinaId, cantidad: 400 },
            { lineaId: lineaPigmentoId, cantidad: 50 },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.estado).toBe('recibida');

      const cancelar = await http()
        .post(`/api/purchase-orders/${ocId}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'cancelada', motivo: 'prueba' });
      expect(cancelar.status).toBe(400);

      const editar = await http()
        .patch(`/api/purchase-orders/${ocId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ notas: 'cambio tardío' });
      expect(editar.status).toBe(400);
    });

    it('cancelar exige motivo y lo guarda', async () => {
      const nueva = await crearOc(tokenA, {
        numero: `OC-CANCEL-${suffix}`,
        proveedorId: proveedorAId,
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      const sinMotivo = await http()
        .post(`/api/purchase-orders/${nueva.body.id}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'cancelada' });
      expect(sinMotivo.status).toBe(400);
      const conMotivo = await http()
        .post(`/api/purchase-orders/${nueva.body.id}/transicion`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ estado: 'cancelada', motivo: 'Proveedor sin capacidad' });
      expect(conMotivo.status).toBe(201);
      expect(conMotivo.body.motivoCancelacion).toBe('Proveedor sin capacidad');
    });
  });

  describe('roles', () => {
    it('cliente_final no puede ver ni crear OCs (403)', async () => {
      const listar = await http().get('/api/purchase-orders').set('Authorization', `Bearer ${tokenClienteFinalA}`);
      expect(listar.status).toBe(403);
      const crear = await crearOc(tokenClienteFinalA, {
        numero: `OC-CF-${suffix}`,
        proveedorId: proveedorAId,
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      expect(crear.status).toBe(403);
    });

    it('sin token devuelve 401', async () => {
      const res = await http().get('/api/purchase-orders');
      expect(res.status).toBe(401);
    });
  });

  describe('aislamiento multi-tenant', () => {
    it('el tenant B no ve la OC de A en su listado ni por id', async () => {
      const listado = await http().get('/api/purchase-orders').set('Authorization', `Bearer ${tokenB}`);
      expect(listado.status).toBe(200);
      expect(listado.body.map((o: { id: string }) => o.id)).not.toContain(ocId);

      const porId = await http().get(`/api/purchase-orders/${ocId}`).set('Authorization', `Bearer ${tokenB}`);
      expect(porId.status).toBe(404);
    });

    it('el tenant B no puede modificar, transicionar ni recibir la OC de A', async () => {
      const editar = await http()
        .patch(`/api/purchase-orders/${ocId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ notas: 'intrusión' });
      expect(editar.status).toBe(404);

      const transicion = await http()
        .post(`/api/purchase-orders/${ocId}/transicion`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ estado: 'cancelada', motivo: 'intrusión' });
      expect(transicion.status).toBe(404);

      const recepcion = await http()
        .post(`/api/purchase-orders/${ocId}/recepciones`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ lineas: [{ lineaId: lineaResinaId, cantidad: 1 }] });
      expect(recepcion.status).toBe(404);
    });

    it('el tenant B no puede crear una OC usando como proveedor un partner de A', async () => {
      const res = await crearOc(tokenB, {
        numero: `OC-B-${suffix}`,
        proveedorId: proveedorAId,
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      expect(res.status).toBe(400);
    });

    it('el mismo número de OC puede existir en tenants distintos', async () => {
      const proveedorB = await http()
        .post('/api/partners')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ tipo: 'proveedor', nombre: `Proveedor B ${suffix}` });
      const res = await crearOc(tokenB, {
        numero: `OC-${suffix}`,
        proveedorId: proveedorB.body.id,
        lineas: [{ sku: 'X', descripcion: 'X', cantidad: 1 }],
      });
      expect(res.status).toBe(201);
    });
  });
});
