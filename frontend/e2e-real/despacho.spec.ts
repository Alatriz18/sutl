import { test, expect, type Page } from '@playwright/test';

// El proveedor registra el despacho real de su orden desde su portal (backend real): en dos salidas,
// y la empresa ve los embarques creados.
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };
const CLAVE = 'PasswordSeguro123';
const unico = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function api(token: string, metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function ingresar(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@demo-transportes.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('Despacho del proveedor (backend real)', () => {
  test('el proveedor despacha su orden en dos salidas y la empresa ve los embarques', async ({ page }) => {
    const id = unico();
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
    const token = (await login.json()).accessToken as string;
    const prov = await api(token, 'POST', '/partners', { tipo: 'proveedor', nombre: `Prov despacho ${id}` });
    const email = `prov-desp-${id}@despacho-e2e.com`;
    expect((await api(token, 'POST', '/users', { email, password: CLAVE, nombre: 'Proveedor Despacho', rol: 'proveedor', partnerId: prov.body.id })).status).toBe(201);
    const numero = `OC-DESP-${id}`;
    const oc = await api(token, 'POST', '/purchase-orders', { numero, proveedorId: prov.body.id, lineas: [{ sku: `S-${id}`, descripcion: 'Material', cantidad: 10, unidad: 'kg' }] });
    expect((await api(token, 'POST', `/purchase-orders/${oc.body.id}/transicion`, { estado: 'emitida' })).status).toBe(201);
    expect((await api(token, 'POST', `/purchase-orders/${oc.body.id}/transicion`, { estado: 'confirmada', fechaConfirmadaProveedor: new Date(Date.now() + 3 * 86400000).toISOString() })).status).toBe(201);

    await ingresar(page, email, CLAVE);
    await expect(page).toHaveURL(/\/dashboard\/mis-ordenes/, { timeout: 20000 });
    await page.getByRole('link', { name: numero }).click();
    await expect(page.getByRole('heading', { name: 'Registrar un despacho' })).toBeVisible();

    // Primera salida: 4 de 10.
    await page.getByLabel('Origen').fill('Shanghai');
    await page.getByLabel('Destino').fill('Guayaquil');
    await page.getByLabel('Guía, BL o AWB (opcional)').fill(`BL-${id}`);
    await page.getByLabel(`Cantidad de S-${id}`).fill('4');
    await page.getByRole('button', { name: 'Registrar despacho' }).click();
    await expect(page.getByText('Despacho registrado.')).toBeVisible();
    await expect(page.getByText('Despachada', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/faltan por despachar 6/)).toBeVisible();

    // Segunda salida: lo que faltaba. Con todo despachado el formulario desaparece.
    await page.getByLabel('Origen').fill('Shanghai');
    await page.getByLabel('Destino').fill('Guayaquil');
    await page.getByRole('button', { name: 'Registrar despacho' }).click();
    await expect(page.getByRole('heading', { name: 'Registrar un despacho' })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: /SUTL-/ }).getByText(/^SUTL-/)).toHaveCount(2);

    // La empresa ve los dos embarques en su orden.
    const detalle = await api(token, 'GET', `/purchase-orders/${oc.body.id}`);
    expect(detalle.body.estado).toBe('despachada');
    expect(detalle.body.lineas[0].embarques).toHaveLength(2);
  });
});
