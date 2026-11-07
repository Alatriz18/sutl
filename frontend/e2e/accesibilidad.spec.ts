import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Auditoría automática de accesibilidad (WCAG 2.1 A/AA) con axe-core sobre las
// pantallas principales en modo demo. Las reglas de contraste quedan fuera de
// este corte (se revisan aparte con el diseño de marca); todo lo demás —
// etiquetas de formulario, nombres de botones y enlaces, roles, idiomas—
// debe dar cero violaciones.
const RUTAS = [
  '/',
  '/login',
  '/dashboard',
  '/dashboard/shipments',
  '/dashboard/compras',
  '/dashboard/compras/importar',
  '/dashboard/cobertura',
  '/dashboard/almacen',
  '/dashboard/configuracion',
  '/dashboard/users',
  '/dashboard/alertas',
  '/dashboard/cotizaciones',
  '/dashboard/reservas',
  '/dashboard/contactos',
  '/dashboard/tarifas',
  '/dashboard/facturacion',
  '/dashboard/navieras',
  '/dashboard/contenedores',
  '/dashboard/documentos',
  '/dashboard/notificaciones',
  '/dashboard/reportes',
  '/dashboard/integraciones',
  '/dashboard/flota',
  '/dashboard/shipments/nuevo',
  '/dashboard/shipments/s1',
  '/dashboard/compras/nueva',
  '/dashboard/reservas/nueva',
  '/dashboard/cobertura/importar',
  '/dashboard/compras/oc1',
];

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
  await page.getByPlaceholder('••••••••').fill('Demo2026!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
}

test.describe('Accesibilidad (axe, modo demo)', () => {
  test.setTimeout(120000);

  for (const ruta of RUTAS) {
    test(`sin violaciones WCAG A/AA en ${ruta}`, async ({ page }) => {
      if (ruta.startsWith('/dashboard')) await entrar(page);
      await page.goto(ruta);
      await page.waitForLoadState('networkidle');
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();
      const resumen = r.violations.map(
        (v) => `${v.id} (${v.nodes.length}): ${v.nodes.map((n) => n.html.replace(/s+/g, ' ').slice(0, 200)).join(' || ')}`,
      );
      expect(resumen, resumen.join('\n')).toEqual([]);
    });
  }
});
