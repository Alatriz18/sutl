import { test, expect, type Page } from '@playwright/test';

// Flujos críticos contra el backend real: lo que el modo demo no puede probar
// (JWT, guards, validación del servidor, aislamiento entre empresas).
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };
const unico = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function ingresar(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@demo-transportes.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

async function tokenApi(email: string, password: string) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).accessToken as string;
}

test.describe('Backend real', () => {
  test('login válido entra al dashboard con datos sembrados', async ({ page }) => {
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.getByText('Envíos totales')).toBeVisible();
  });

  test('credenciales inválidas: mensaje de error y no entra', async ({ page }) => {
    await ingresar(page, DEMO.email, 'incorrecta-123');
    await expect(page.getByText(/credenciales inv/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sin sesión, una ruta del panel redirige al login', async ({ page }) => {
    await page.goto('/dashboard/shipments');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('crea un envío, lo ve en el detalle y en el tracking público', async ({ page }) => {
    const remitente = `Remitente ${unico()}`;
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/shipments/nuevo');
    await page.getByLabel('Remitente', { exact: true }).fill(remitente);
    await page.getByLabel('Destinatario', { exact: true }).fill('Destinatario E2E');
    await page.getByLabel('Origen', { exact: true }).fill('Guayaquil, EC');
    await page.getByLabel('Destino', { exact: true }).fill('Quito, EC');
    await page.getByRole('button', { name: 'Crear envío' }).click();
    await expect(page).toHaveURL(/\/dashboard\/shipments\/.+/, { timeout: 15000 });
    await expect(page.getByText(remitente)).toBeVisible();

    const codigo = (await page.locator('h1').first().innerText()).trim();
    expect(codigo).toMatch(/^SUTL-/);
    await page.goto(`/tracking/${codigo}`);
    await expect(page.getByText(codigo).first()).toBeVisible();
  });

  test('órdenes de compra: crear y emitir', async ({ page }) => {
    const numero = `OC-E2E-${unico()}`;
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/compras/nueva');
    await page.getByLabel('N° de OC (como está en tu ERP)').fill(numero);
    await page.getByLabel('Proveedor').selectOption({ index: 1 });
    await page.getByLabel('SKU').fill('E2E-SKU');
    await page.getByLabel('Descripción').fill('Artículo de prueba');
    await page.getByLabel('Cantidad').fill('100');
    await page.getByRole('button', { name: 'Crear OC en borrador' }).click();
    await expect(page.getByRole('heading', { name: numero })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Emitir OC' }).click();
    await expect(page.getByText('OC emitida.')).toBeVisible();
  });

  test('cobertura de inventario muestra los SKU con política', async ({ page }) => {
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/cobertura');
    await expect(page.getByRole('heading', { level: 1, name: /Cobertura de inventario/i })).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
  });

  test('riesgo de abastecimiento: el motor del servidor clasifica los SKU sembrados', async ({ page }) => {
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/riesgo');
    await expect(page.getByRole('heading', { level: 1, name: 'Riesgo de abastecimiento' })).toBeVisible();
    await page.getByRole('button', { name: 'Todos', exact: true }).click();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
    // Cada fila lleva su semáforo en texto (el color nunca va solo).
    await expect(page.getByText(/^(Rojo|Amarillo|Verde|Sin datos)$/).first()).toBeVisible();
  });

  test('notificaciones: un correo enviado desde la web llega de verdad (Mailpit)', async ({ page }) => {
    const asunto = `Aviso E2E ${unico()}`;
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/notificaciones');
    await page.getByLabel('Correo de destino').fill('cliente-e2e@ejemplo.com');
    await page.getByLabel('Asunto').fill(asunto);
    await page.getByLabel('Mensaje').fill('Prueba de envío real.');
    await page.getByRole('button', { name: 'Enviar notificación' }).click();
    await expect(page.getByRole('row').filter({ hasText: asunto })).toContainText('Enviada', { timeout: 15000 });

    const res = await fetch(`http://localhost:8025/api/v1/search?query=${encodeURIComponent(`subject:"${asunto}"`)}`);
    const msgs = ((await res.json()) as { messages: { To: { Address: string }[] }[] }).messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].To[0].Address).toBe('cliente-e2e@ejemplo.com');
  });

  test('aislamiento entre empresas: otra empresa no ve los envíos de la demo', async ({ page }) => {
    // Crea una empresa nueva (super_admin) con un usuario, vía la API real.
    const sa = await tokenApi('admin@sutl.dev', 'SutlAdmin2026!');
    const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${sa}` };
    const id = unico();
    const t = await (
      await fetch(`${API}/tenants`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ nombre: `Aislada ${id}`, plan: 'trial' }),
      })
    ).json();
    const email = `aislada-${id}@e2e-test.com`;
    const reg = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ tenantId: t.id, email, password: 'PasswordSeguro123', nombre: 'Usuario Aislado' }),
    });
    expect(reg.status).toBe(201);

    await ingresar(page, email, 'PasswordSeguro123');
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await page.goto('/dashboard/shipments');
    await expect(page.getByRole('heading', { level: 1, name: /Envíos/i })).toBeVisible();
    await expect(page.getByText('SUTL-DEMO-0001')).toHaveCount(0);
  });

  test('un operador no ve las secciones de administración', async ({ page }) => {
    await ingresar(page, 'operador@demo-transportes.com', DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.getByRole('link', { name: 'Empresas (tenants)' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    // Control positivo: el panel sí cargó (si no, los 0 de arriba no dirían nada).
    await expect(page.getByRole('link', { name: 'Envíos' }).first()).toBeVisible();
  });

  test('un admin de empresa sí ve Usuarios pero no Empresas', async ({ page }) => {
    await ingresar(page, DEMO.email, DEMO.password);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
    await expect(page.getByRole('link', { name: 'Usuarios' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Empresas (tenants)' })).toHaveCount(0);
  });
});
