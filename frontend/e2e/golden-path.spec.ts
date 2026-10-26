import { test, expect } from '@playwright/test';

// Flujo principal del modo demo: landing → login → dashboard poblado →
// crear un envío → verlo en el detalle → tracking público del mismo envío.
// No sustituye pruebas contra el backend real — ver backend/test/*.e2e-spec.ts
// para la seguridad/aislamiento real. Esto protege la experiencia que ve un
// inversionista o un cliente potencial en el deploy de Vercel.

test.describe('Flujo principal (modo demo)', () => {
  test('landing muestra el hero y navega a login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Visibilidad total de tus envíos/i })).toBeVisible();
    await page.getByRole('link', { name: 'Ingresar al panel' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('login con credenciales demo entra al dashboard con datos poblados', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
    await page.getByPlaceholder('••••••••').fill('Demo2026!');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
    await expect(page.getByText('SUTL-DEMO-0001')).toBeVisible();
    await expect(page.getByText('Envíos totales')).toBeVisible();
  });

  test('login con credenciales inválidas muestra error y no entra', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
    await page.getByPlaceholder('••••••••').fill('password-incorrecto');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByText('Credenciales inválidas')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('crea un envío nuevo y aparece en el listado', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
    await page.getByPlaceholder('••••••••').fill('Demo2026!');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/dashboard/shipments/nuevo');
    await page.getByLabel('Remitente', { exact: true }).fill('Playwright Test Remitente');
    await page.getByLabel('Destinatario', { exact: true }).fill('Playwright Test Destinatario');
    await page.getByLabel('Origen', { exact: true }).fill('Guayaquil, EC');
    await page.getByLabel('Destino', { exact: true }).fill('Quito, EC');
    await page.getByRole('button', { name: 'Crear envío' }).click();

    await expect(page).toHaveURL(/\/dashboard\/shipments\/.+/);
    await expect(page.getByText('Playwright Test Remitente')).toBeVisible();
  });

  test('tracking público encuentra un envío existente por código de guía', async ({ page }) => {
    await page.goto('/tracking/SUTL-DEMO-0003');
    await expect(page.getByText('SUTL-DEMO-0003')).toBeVisible();
    await expect(page.getByText('Entregado').first()).toBeVisible();
  });

  test('tracking público de un código inexistente muestra error, no una pantalla rota', async ({ page }) => {
    await page.goto('/tracking/SUTL-NO-EXISTE-0000');
    await expect(page.getByText(/No encontramos un envío/i)).toBeVisible();
  });
});
