import { test, expect } from '@playwright/test';

// La empresa define cuántos días de tránsito estimar para las órdenes que aún no viajan (backend real).
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };

test.describe('Días de tránsito estimados (backend real)', () => {
  test('el administrador lo cambia en Configuración y queda guardado', async ({ page }) => {
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
    const token = (await login.json()).accessToken as string;
    const fijar = (dias: number) =>
      fetch(`${API}/tenant-config`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ configuracion: { riesgo: { diasTransitoEstimado: dias } } }) });
    try {
      await page.goto('/login');
      await page.getByPlaceholder('admin@demo-transportes.com').fill(DEMO.email);
      await page.getByPlaceholder('••••••••').fill(DEMO.password);
      await page.getByRole('button', { name: 'Ingresar' }).click();
      await page.waitForURL('**/dashboard');

      await page.goto('/dashboard/configuracion');
      await page.getByLabel('Días de tránsito estimados').fill('12');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(page.getByText('Configuración guardada.')).toBeVisible();

      await page.reload();
      await expect(page.getByLabel('Días de tránsito estimados')).toHaveValue('12');
    } finally {
      await fijar(0); // la empresa de demostración vuelve a su valor de siempre
    }
  });
});
