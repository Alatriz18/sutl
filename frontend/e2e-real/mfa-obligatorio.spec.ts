import { createHmac } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';

// Segundo factor obligatorio contra el backend real: la empresa lo exige y un administrador sin él es llevado
// a activarlo (con código QR) antes de poder usar el resto del sistema.
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };
const CLAVE = 'PasswordSeguro123';
const unico = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

// TOTP (RFC 6238, SHA-1, 30 s, 6 dígitos) para obtener el código que mostraría la app.
function codigoTotp(secretoBase32: string): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretoBase32.replace(/\s/g, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = createHmac('sha1', bytes).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

async function api(token: string, metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function token(email: string, password: string) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).accessToken as string;
}

async function ingresar(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@demo-transportes.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('Segundo factor obligatorio (backend real)', () => {
  test('el administrador sin segundo factor es llevado a activarlo, con QR, y luego recupera el acceso', async ({ page }) => {
    const id = unico();
    const demo = await token(DEMO.email, DEMO.password);
    const emailGuia = `guia-mfa-${id}@mfa-e2e.com`;
    const emailNuevo = `nuevo-mfa-${id}@mfa-e2e.com`;
    // Dos administradores descartables: «guia» activa su segundo factor y exige la política; «nuevo» no tiene.
    expect((await api(demo, 'POST', '/users', { email: emailGuia, password: CLAVE, nombre: 'Guía MFA', rol: 'admin_tenant' })).status).toBe(201);
    expect((await api(demo, 'POST', '/users', { email: emailNuevo, password: CLAVE, nombre: 'Nuevo MFA', rol: 'admin_tenant' })).status).toBe(201);
    const guia = await token(emailGuia, CLAVE);
    const ini = await api(guia, 'POST', '/auth/mfa/iniciar');
    expect((await api(guia, 'POST', '/auth/mfa/activar', { codigo: codigoTotp(ini.body.secreto) })).status).toBe(200);
    const exigir = (valor: boolean) => api(guia, 'PATCH', '/tenant-config', { configuracion: { seguridad: { exigirMfaAdministradores: valor } } });
    try {
      expect((await exigir(true)).status).toBe(200);

      await ingresar(page, emailNuevo, CLAVE);
      await page.waitForURL('**/dashboard/seguridad');
      await expect(page.getByRole('alert').filter({ hasText: 'Tu empresa exige el segundo factor' })).toBeVisible();

      await page.getByRole('button', { name: 'Activar segundo factor' }).click();
      await expect(page.getByRole('img', { name: /Código QR/ })).toBeVisible();
      const secreto = (await page.locator('code').first().innerText()).replace(/\s/g, '');
      await page.getByLabel('Código de 6 dígitos').fill(codigoTotp(secreto));
      await page.getByRole('button', { name: 'Activar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Guarda tus códigos de recuperación' })).toBeVisible();
      await page.getByRole('button', { name: 'Ya los guardé' }).click();
      await expect(page.getByRole('heading', { name: 'Segundo factor activo' })).toBeVisible();

      // Ya con el segundo factor, el resto del sistema vuelve a abrirse.
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    } finally {
      // La empresa de demostración queda como estaba y los usuarios descartables, sin acceso.
      await exigir(false);
      for (const email of [emailGuia, emailNuevo]) {
        const lista = await api(demo, 'GET', '/users');
        const u = (lista.body as { id: string; email: string }[] | { data: { id: string; email: string }[] }) ;
        const filas = Array.isArray(u) ? u : u.data ?? [];
        const fila = filas.find((x) => x.email === email);
        if (fila) await api(demo, 'PATCH', `/users/${fila.id}`, { activo: false });
      }
    }
  });
});
