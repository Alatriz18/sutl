import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Metas de OTIF por empresa y exportación a Excel contra el backend real.
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };

test.describe('Analítica: metas y Excel (backend real)', () => {
  test('el administrador cambia la meta, la analítica la usa y el Excel se descarga', async ({ page }) => {
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
    const token = (await login.json()).accessToken as string;
    const fijar = (meta: number, umbral: number) =>
      fetch(`${API}/tenant-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ configuracion: { analitica: { metaOtifPct: meta, umbralAtencionOtifPct: umbral } } }),
      });
    try {
      await page.goto('/login');
      await page.getByPlaceholder('admin@demo-transportes.com').fill(DEMO.email);
      await page.getByPlaceholder('••••••••').fill(DEMO.password);
      await page.getByRole('button', { name: 'Ingresar' }).click();
      await page.waitForURL('**/dashboard');

      await page.goto('/dashboard/configuracion');
      await page.getByLabel('Meta de OTIF').fill('96');
      await page.getByLabel('Umbral de atención').fill('85');
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(page.getByText('Configuración guardada.')).toBeVisible();

      await page.goto('/dashboard/analitica');
      await expect(page.getByText('A tiempo y completas · meta 96 %')).toBeVisible();

      const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar a Excel' }).click()]);
      const bytes = readFileSync((await descarga.path()) as string);
      expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
      const texto = bytes.toString('utf8');
      expect(texto).toContain('xl/worksheets/sheet1.xml');
      expect(texto).toContain('Meta de OTIF (%)');
    } finally {
      // La empresa de demostración queda con sus metas de siempre.
      await fijar(90, 70);
    }
  });
});
