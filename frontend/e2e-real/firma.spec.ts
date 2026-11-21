import { test, expect } from '@playwright/test';

// Prueba de entrega con firma en pantalla contra el backend real: la firma se guarda y se vuelve a mostrar.
const API = 'http://localhost:3001/api';
const DEMO = { email: 'admin@demo-transportes.com', password: 'Demo2026!' };

test('el equipo registra la entrega con firma en pantalla y la firma se muestra desde el servidor', async ({ page }) => {
  const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO) });
  const token = (await login.json()).accessToken as string;
  const envio = await fetch(`${API}/shipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tipo: 'importacion', modo: 'terrestre', remitenteNombre: 'Remitente', destinatarioNombre: 'Destinatario', origen: 'Quito', destino: 'Cuenca' }),
  });
  const { id } = (await envio.json()) as { id: string };

  await page.goto('/login');
  await page.getByPlaceholder('admin@demo-transportes.com').fill(DEMO.email);
  await page.getByPlaceholder('••••••••').fill(DEMO.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL('**/dashboard');
  await page.goto(`/dashboard/shipments/${id}`);

  await page.getByLabel('Quién recibió').fill('Marta Firma');
  const lienzo = page.getByRole('img', { name: /Firma de quien recibe/ });
  await lienzo.scrollIntoViewIfNeeded();
  const caja = (await lienzo.boundingBox())!;
  await page.mouse.move(caja.x + 30, caja.y + 40);
  await page.mouse.down();
  await page.mouse.move(caja.x + 150, caja.y + 100, { steps: 10 });
  await page.mouse.move(caja.x + 260, caja.y + 40, { steps: 10 });
  await page.mouse.up();
  // Foto tomada con la cámara del celular (aquí se simula con un archivo de imagen).
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
  await page.getByLabel('Tomar foto con la cámara').setInputFiles({ name: 'foto-entrega.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('Foto lista: foto-entrega.png')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar entrega' }).click();

  const firma = page.getByRole('img', { name: 'Firma de Marta Firma' });
  await expect(firma).toBeVisible();
  // La imagen se cargó de verdad desde el servidor (no es un enlace roto).
  await expect.poll(() => firma.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  const pod = await fetch(`${API}/shipments/${id}/pod`, { headers: { Authorization: `Bearer ${token}` } });
  const datos = await pod.json();
  expect(datos.tieneFirma).toBe(true);
  expect(datos.archivoNombre).toBe('foto-entrega.png');
});
