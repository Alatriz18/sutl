import { test, expect, type Page } from '@playwright/test';

// Portal colaborativo contra el backend real: un proveedor y un cliente final entran con su propio
// usuario, ven solo lo suyo, conversan con la empresa y el proveedor confirma su orden.
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };
const CLAVE = 'PasswordSeguro123';
const unico = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function ingresar(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@demo-transportes.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

async function api(token: string, metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.describe('Seguimiento en vivo (backend real)', () => {
  test('la página pública se actualiza sola cuando la empresa registra un movimiento, y dibuja el recorrido', async ({ page }) => {
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
    const token = (await login.json()).accessToken as string;
    const envio = await api(token, 'POST', '/shipments', {
      tipo: 'importacion', modo: 'maritimo', remitenteNombre: 'Remitente', destinatarioNombre: 'Cliente vivo',
      origen: 'Shanghai', destino: 'Guayaquil',
    });
    expect(envio.status).toBe(201);
    await page.goto(`/tracking/${envio.body.codigoGuia}`);
    await expect(page.getByTestId('indicador-en-vivo')).toHaveAttribute('data-estado', 'en_vivo');
    await expect(page.getByTestId('recorrido-mapa')).toHaveCount(0);

    const ev = await api(token, 'POST', '/tracking-events', { shipmentId: envio.body.id, estado: 'en_transito', ubicacion: 'Puerto de Guayaquil', descripcion: 'Zarpó en vivo', lat: -2.28, lng: -79.91 });
    expect(ev.status).toBe(201);
    // Sin recargar la página.
    await expect(page.getByText('Zarpó en vivo')).toBeVisible();
    await expect(page.getByRole('img', { name: /Mapa del recorrido: 1 punto; último: Puerto de Guayaquil/ })).toBeVisible();
  });
});

test.describe('Portal (backend real)', () => {
  const id = unico();
  const emailProveedor = `prov-${id}@portal-e2e.com`;
  const emailCliente = `cliente-${id}@portal-e2e.com`;
  const numeroOc = `OC-PORTAL-${id}`;
  let guia = '';

  test.beforeAll(async () => {
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
    const token = (await login.json()).accessToken as string;
    const prov = await api(token, 'POST', '/partners', { tipo: 'proveedor', nombre: `Proveedor portal ${id}` });
    const oc = await api(token, 'POST', '/purchase-orders', {
      numero: numeroOc,
      proveedorId: prov.body.id,
      lineas: [{ sku: `SKU-${id}`, descripcion: 'Material de prueba', cantidad: 10, unidad: 'kg' }],
    });
    expect((await api(token, 'POST', `/purchase-orders/${oc.body.id}/transicion`, { estado: 'emitida' })).status).toBe(201);
    expect((await api(token, 'POST', '/users', { email: emailProveedor, password: CLAVE, nombre: 'Proveedor E2E', rol: 'proveedor', partnerId: prov.body.id })).status).toBe(201);
    expect((await api(token, 'POST', '/users', { email: emailCliente, password: CLAVE, nombre: 'Cliente E2E', rol: 'cliente_final' })).status).toBe(201);
    const envio = await api(token, 'POST', '/shipments', {
      tipo: 'importacion', modo: 'maritimo', remitenteNombre: 'Remitente', destinatarioNombre: 'Cliente E2E',
      destinatarioEmail: emailCliente, origen: 'Shanghai', destino: 'Guayaquil',
    });
    guia = envio.body.codigoGuia;
  });

  test('el seguimiento público muestra la marca que configuró la empresa, y vuelve al valor por defecto al quitarla', async ({ page }) => {
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
    const token = (await login.json()).accessToken as string;
    const nombre = `Marca ${id}`;
    expect((await api(token, 'PATCH', '/tenant-config', { configuracion: { marca: { nombreComercial: nombre, colorPrimario: '#1A7A4C', mensaje: 'Gracias por elegirnos', mostrarSutl: false } } })).status).toBe(200);
    try {
      await page.goto(`/tracking/${guia}`);
      await expect(page.getByTestId('marca-encabezado')).toContainText(nombre);
      await expect(page.getByText('Gracias por elegirnos')).toBeVisible();
      await expect(page.getByText('Con tecnología de SUTL')).toHaveCount(0);
      await expect(page.getByTestId('marca-encabezado')).toHaveCSS('background-color', 'rgb(26, 122, 76)');
    } finally {
      await api(token, 'PATCH', '/tenant-config', { configuracion: { marca: { nombreComercial: '', colorPrimario: '', mensaje: '', mostrarSutl: true } } });
    }
    await page.goto(`/tracking/${guia}`);
    await expect(page.getByText('Con tecnología de SUTL')).toBeVisible();
  });

  test('el proveedor solo ve sus órdenes, confirma una con su fecha y escribe a la empresa', async ({ page }) => {
    await ingresar(page, emailProveedor, CLAVE);
    await expect(page).toHaveURL(/\/dashboard\/mis-ordenes/, { timeout: 20000 });
    // Su menú no incluye nada del equipo.
    await expect(page.getByRole('link', { name: 'Mis órdenes de compra' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Envíos', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);

    await page.getByRole('link', { name: numeroOc }).click();
    await expect(page.getByRole('heading', { name: `Orden ${numeroOc}` })).toBeVisible();
    await page.getByLabel('Fecha de despacho comprometida').fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Confirmar orden' }).click();
    await expect(page.getByText('Confirmada', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Confirmar la orden' })).toHaveCount(0);

    await page.getByLabel('Escribir un mensaje').fill('Despachamos la fecha acordada.');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('list', { name: 'Mensajes' }).getByText('Despachamos la fecha acordada.')).toBeVisible();
  });

  test('el cliente final ve solo su envío, sin controles de gestión, y escribe a la empresa', async ({ page }) => {
    await ingresar(page, emailCliente, CLAVE);
    await expect(page).toHaveURL(/\/dashboard\/mis-envios/, { timeout: 20000 });
    await expect(page.getByRole('link', { name: guia })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo envío' })).toHaveCount(0);

    await page.getByRole('link', { name: guia }).click();
    await expect(page.getByRole('heading', { name: guia })).toBeVisible();
    await page.getByLabel('Escribir un mensaje').fill('¿Hay novedades de mi carga?');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('list', { name: 'Mensajes' }).getByText('¿Hay novedades de mi carga?')).toBeVisible();

    // Una ruta del equipo no le sirve aunque la escriba a mano: el servidor se la niega.
    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toHaveCount(0);
  });

  test('la empresa ve los mensajes del cliente y puede responderle', async ({ page }) => {
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/shipments');
    await page.getByRole('link', { name: guia }).click();
    await expect(page.getByRole('heading', { name: 'Conversación con el cliente' })).toBeVisible();
    await expect(page.getByText('¿Hay novedades de mi carga?')).toBeVisible();
    await page.getByLabel('Escribir un mensaje').fill('Zarpó ayer, llega la próxima semana.');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('Zarpó ayer, llega la próxima semana.')).toBeVisible();
  });

  test('la empresa registra la prueba de entrega con evidencia y el cliente final la ve en su portal', async ({ page }) => {
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/shipments');
    await page.getByRole('link', { name: guia }).click();
    await expect(page.getByRole('heading', { name: 'Prueba de entrega' })).toBeVisible();
    await page.getByLabel('Quién recibió').fill('Recepción Bodega Norte');
    await page.getByLabel('Evidencia (foto o PDF, opcional)').setInputFiles({ name: 'firma.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 firma') });
    await page.getByRole('button', { name: 'Registrar entrega' }).click();
    await expect(page.getByText('Recibió', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descargar evidencia' })).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await ingresar(page, emailCliente, CLAVE);
    await expect(page).toHaveURL(/\/dashboard\/mis-envios/, { timeout: 20000 });
    await page.getByRole('link', { name: guia }).click();
    await expect(page.getByText('Recepción Bodega Norte', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Descargar evidencia' })).toBeVisible();
  });
});
