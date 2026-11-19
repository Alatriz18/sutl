import { test, expect } from '@playwright/test';

// Evidencia adjunta a una tarea contra el backend real: se sube desde la pantalla y se descarga igual.
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };

test.describe('Evidencia de tareas (backend real)', () => {
  test('el administrador adjunta un archivo a una tarea y lo descarga', async ({ page }) => {
    const titulo = `Tarea evidencia ${Date.now().toString(36)}`;
    const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
    const token = (await login.json()).accessToken as string;
    const t = await fetch(`${API}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ titulo }) });
    expect(t.status).toBe(201);

    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill(DEMO.email);
    await page.getByPlaceholder('••••••••').fill(DEMO.password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
    await page.goto('/dashboard/tareas');
    await page.getByRole('button', { name: titulo }).click();

    const contenido = '%PDF-1.4 evidencia real';
    await page.getByLabel('Archivo de evidencia').setInputFiles({ name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: Buffer.from(contenido) });
    await page.getByRole('button', { name: 'Adjuntar evidencia' }).click();
    await expect(page.getByRole('button', { name: 'comprobante.pdf' })).toBeVisible();
    await expect(page.getByText(/adjuntó evidencia/)).toBeVisible();

    const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'comprobante.pdf' }).click()]);
    expect(descarga.suggestedFilename()).toBe('comprobante.pdf');
    const { readFile } = await import('fs/promises');
    expect((await readFile((await descarga.path())!, 'utf8'))).toBe(contenido);
  });
});
