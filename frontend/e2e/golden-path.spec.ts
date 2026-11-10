import { test, expect } from '@playwright/test';

// Flujo principal del modo demo: landing → login → dashboard poblado →
// crear un envío → verlo en el detalle → tracking público del mismo envío.
// No sustituye pruebas contra el backend real — ver backend/test/*.e2e-spec.ts
// para la seguridad/aislamiento real. Esto protege la experiencia que ve un
// inversionista o un cliente potencial en el deploy de Vercel.

test.describe('Flujo principal (modo demo)', () => {
  test('landing muestra el hero y navega a login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /Orquesta a quienes la mueven/i })).toBeVisible();
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

  test('órdenes de compra: lista con alertas y recepción que cierra la OC', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
    await page.getByPlaceholder('••••••••').fill('Demo2026!');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Órdenes de compra' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Órdenes de compra' })).toBeVisible();
    await expect(page.getByText('OC-2026-0431')).toBeVisible();
    await expect(page.getByText(/despacha 4 días después de la fecha requerida/).first()).toBeVisible();

    await page.getByRole('link', { name: 'OC-2026-0442' }).click();
    await expect(page.getByRole('heading', { name: 'OC-2026-0442' })).toBeVisible();
    await page.getByLabel('Cantidad recibida de CAJ-30x40').fill('8000');
    await page.getByRole('button', { name: 'Registrar recepción' }).click();
    await expect(page.getByText('Recepción registrada.')).toBeVisible();
    await expect(page.getByText('Recibida', { exact: true }).first()).toBeVisible();
  });

  test('órdenes de compra: crear una OC y emitirla', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
    await page.getByPlaceholder('••••••••').fill('Demo2026!');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/dashboard/compras/nueva');
    await page.getByLabel('N° de OC (como está en tu ERP)').fill('OC-PLAYWRIGHT-001');
    await page.getByLabel('Proveedor').selectOption({ label: 'Empaques del Litoral S.A.' });
    await page.getByLabel('SKU').fill('TAP-28');
    await page.getByLabel('Descripción').fill('Tapa rosca 28 mm');
    await page.getByLabel('Cantidad').fill('10000');
    await page.getByRole('button', { name: 'Crear OC en borrador' }).click();

    await expect(page.getByRole('heading', { name: 'OC-PLAYWRIGHT-001' })).toBeVisible();
    await page.getByRole('button', { name: 'Emitir OC' }).click();
    await expect(page.getByText('OC emitida.')).toBeVisible();
    await expect(page.getByLabel('Fecha de despacho comprometida por el proveedor')).toBeVisible();
  });

  test('configuración de la operación: el perfil Manufactura hace que la recepción entre al inventario', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
    await page.getByPlaceholder('••••••••').fill('Demo2026!');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Navegación por clics (no page.goto): el modo demo guarda los datos en memoria.
    await page.getByRole('link', { name: 'Configuración de la operación' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Configuración de la operación' })).toBeVisible();
    await expect(page.getByLabel('Tolerancia de sobre-recepción')).toHaveValue('0');
    await page.getByText('Manufactura', { exact: true }).click();
    await page.getByRole('button', { name: 'Aplicar perfil' }).click();
    await expect(page.getByText('Perfil aplicado con sus valores sugeridos.')).toBeVisible();
    await expect(page.getByLabel('Tolerancia de sobre-recepción')).toHaveValue('5');

    // Ajuste propio encima del perfil.
    await page.getByLabel('Alerta anticipada').fill('21');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Configuración guardada.')).toBeVisible();
    await expect(page.getByText('Ajustado · sugerido: 14 días')).toBeVisible();

    await page.getByRole('link', { name: 'Órdenes de compra' }).first().click();
    await page.getByRole('link', { name: 'OC-2026-0442' }).click();
    await expect(page.getByLabel('Bodega de destino')).toHaveValue('wh-1');
    await page.getByLabel('Cantidad recibida de CAJ-30x40').fill('8000');
    await page.getByRole('button', { name: 'Registrar recepción' }).click();
    await expect(page.getByText('Recepción registrada e ingresada al inventario.')).toBeVisible();
    await expect(page.getByText('→ Bodega Guayaquil Central').first()).toBeVisible();

    await page.getByRole('link', { name: 'Almacén' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Almacén e inventario' })).toBeVisible();
    // CAJ-30x40 ya tenía 12.000 en Almacén: lo recibido (8.000) se suma al mismo ítem.
    await expect(page.getByRole('row', { name: /CAJ-30x40/ })).toContainText('20.000');
  });

  // Los datos del modo demo viven en memoria: dentro de cada prueba se navega
  // por clics (no con page.goto) para no reiniciarlos.
  async function entrar(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByPlaceholder('admin@demo-transportes.com').fill('admin@demo-transportes.com');
    await page.getByPlaceholder('••••••••').fill('Demo2026!');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  test('vínculo OC ↔ embarque: alerta por la ETA real y vincular carga a un embarque', async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Órdenes de compra' }).first().click();
    await page.getByRole('link', { name: 'OC-2026-0418' }).click();
    await expect(page.getByRole('heading', { name: 'OC-2026-0418' })).toBeVisible();
    // Un embarque llega 6 días después de la fecha requerida: la alerta usa la ETA real.
    await expect(page.getByText(/El embarque SUTL-DEMO-0012 llega 6 días después de la fecha requerida/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'SUTL-DEMO-0011' })).toBeVisible();

    // No se puede asignar más de lo pedido.
    await page.getByLabel('Vincular un embarque').selectOption({ label: 'SUTL-DEMO-0013 · Guayaquil, EC → Guayaquil, EC' });
    await page.getByLabel('Cantidad de RES-PET-01 en este embarque').fill('100');
    await page.getByRole('button', { name: 'Guardar vínculo' }).click();
    await expect(page.getByText(/excede lo pedido/)).toBeVisible();

    // Una OC confirmada sin embarques: se le vincula uno y el envío muestra la OC.
    await page.getByRole('link', { name: 'Órdenes de compra' }).first().click();
    await page.getByRole('link', { name: 'OC-2026-0431' }).click();
    await page.getByLabel('Vincular un embarque').selectOption({ label: 'SUTL-DEMO-0011 · Ningbo, CN → Guayaquil, EC' });
    await expect(page.getByLabel('Cantidad de PIG-AZ-02 en este embarque')).toHaveValue('800');
    await page.getByRole('button', { name: 'Guardar vínculo' }).click();
    await expect(page.getByText('Embarque vinculado.')).toBeVisible();
    await page.getByRole('link', { name: 'SUTL-DEMO-0011' }).click();
    await expect(page.getByRole('heading', { name: 'Órdenes de compra en este embarque' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'OC-2026-0431' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'OC-2026-0418' }).first()).toBeVisible();
  });

  test('cobertura de inventario: días de cobertura, filtro en riesgo y edición de parámetros', async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Cobertura de inventario' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cobertura de inventario' })).toBeVisible();
    const fila = (sku: string) => page.getByRole('row', { name: new RegExp(sku) });
    await expect(fila('RES-PET-01')).toContainText('12 días'); // 18.000 kg / 1.500 por día
    await expect(fila('RES-PP-07')).toContainText('22,5 días');

    await page.getByRole('button', { name: 'En riesgo' }).click();
    await expect(fila('PIG-AZ-02')).toBeVisible();
    await expect(page.getByRole('row', { name: /RES-PP-07/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Todos' }).click();

    await page.getByRole('button', { name: 'Editar parámetros de RES-PET-01' }).click();
    await page.getByLabel('Consumo diario').fill('1000');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Parámetros guardados.')).toBeVisible();
    await expect(fila('RES-PET-01')).toContainText('18 días');
  });

  test('importar OCs desde un CSV de Excel: mapeo automático, validación y carga', async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Órdenes de compra' }).first().click();
    await page.getByRole('link', { name: 'Importar CSV' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Importar órdenes de compra' })).toBeVisible();

    // CSV como lo exporta Excel en español: «;», fechas dd/mm/aaaa y decimales con coma.
    const csv = [
      'N° Pedido;Proveedor;Fecha requerida;Código;Descripción;Cantidad;Precio',
      'OC-CSV-001;Empaques del Litoral S.A.;20/12/2026;TAP-28;Tapa rosca 28 mm;"10.000";0,05',
      'OC-CSV-001;;;TAP-30;Tapa rosca 30 mm;5000;0,06',
      'OC-CSV-002;Proveedor Inexistente;20/12/2026;X-1;Algo;10;1',
    ].join('\r\n');
    await page.getByLabel('Elegir archivo Excel o CSV').setInputFiles({ name: 'pedidos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });

    await expect(page.getByLabel('N° de OC *')).toHaveValue('N° Pedido');
    await expect(page.getByLabel('Cantidad *')).toHaveValue('Cantidad');
    await page.getByRole('button', { name: 'Validar archivo' }).click();
    await expect(page.getByText('Resultado de la validación')).toBeVisible();
    await expect(page.getByText(/Proveedor no encontrado: «Proveedor Inexistente»/)).toBeVisible();
    await expect(page.getByText('Se importará')).toBeVisible();

    await page.getByRole('button', { name: 'Importar 1 OC' }).click();
    await expect(page.getByText('Importación terminada')).toBeVisible();
    await page.getByRole('link', { name: /Ver órdenes de compra/ }).click();
    await expect(page.getByRole('link', { name: 'OC-CSV-001' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'OC-CSV-002' })).toHaveCount(0);
  });

  test('importar OCs desde un archivo Excel (.xlsx): números y fechas reales, fila vacía ignorada', async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Órdenes de compra' }).first().click();
    await page.getByRole('link', { name: 'Importar CSV' }).click();
    await page.getByLabel('Elegir archivo Excel o CSV').setInputFiles('e2e/fixtures/pedidos.xlsx');

    await expect(page.getByLabel('N° de OC *')).toHaveValue('N° Pedido');
    await page.getByRole('button', { name: 'Validar archivo' }).click();
    await expect(page.getByText('Resultado de la validación')).toBeVisible();
    await expect(page.getByText(/Proveedor no encontrado: «Proveedor Inexistente»/)).toBeVisible();
    // El error apunta a la fila real de la hoja (la 6), no a la posición tras descartar la vacía.
    await expect(page.getByText('Línea 6 del archivo')).toBeVisible();

    await page.getByRole('button', { name: 'Importar 1 OC' }).click();
    await expect(page.getByText('Importación terminada')).toBeVisible();
    await page.getByRole('link', { name: /Ver órdenes de compra/ }).click();
    await page.getByRole('link', { name: 'OC-XLSX-001' }).click();
    // 10000 como número real de Excel (no «10.000» como texto) y la fecha 20/12/2026.
    await expect(page.getByText('10.000').first()).toBeVisible();
  });

  test('importar: un .xlsx dañado muestra un error claro y un .xls antiguo se rechaza', async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Órdenes de compra' }).first().click();
    await page.getByRole('link', { name: 'Importar CSV' }).click();
    const input = page.getByLabel('Elegir archivo Excel o CSV');
    await input.setInputFiles({ name: 'roto.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('esto no es un zip') });
    await expect(page.getByText(/No pude leer el archivo/)).toBeVisible();
    await input.setInputFiles({ name: 'viejo.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') });
    await expect(page.getByText(/Excel antiguo/)).toBeVisible();
  });

  test('riesgo de abastecimiento: semáforo por SKU, acción recomendada y filtros', async ({ page }) => {
    await entrar(page);
    await page.getByRole('link', { name: 'Riesgo de abastecimiento' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Riesgo de abastecimiento' })).toBeVisible();

    // Por defecto muestra lo que requiere atención: el rojo y el amarillo, no los verdes.
    const fila = (sku: string) => page.getByRole('row').filter({ hasText: sku });
    await expect(fila('PIG-AZ-02')).toContainText('Rojo');
    await expect(fila('PIG-AZ-02')).toContainText('Urgir al proveedor que despache ya');
    await expect(fila('PIG-AZ-02')).toContainText('sin fecha de llegada');
    await expect(fila('RES-PET-01')).toContainText('Amarillo');
    await expect(fila('ELEC-4471')).toHaveCount(0);

    await page.getByRole('button', { name: 'Verde', exact: true }).click();
    await expect(fila('ELEC-4471')).toContainText('Verde');
    await expect(fila('PIG-AZ-02')).toHaveCount(0);

    await page.getByRole('button', { name: 'Sin datos', exact: true }).click();
    await expect(fila('FLM-STR-23')).toContainText('no tiene política');
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
