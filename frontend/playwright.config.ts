import { defineConfig, devices } from '@playwright/test';

// E2e del flujo principal en modo demo (sin backend real). El servidor de
// dev arranca solo si no hay uno corriendo ya en el puerto — ver webServer.
export default defineConfig({
  testDir: './e2e',
  // Un solo worker: Next dev compila cada ruta on-demand en la primera
  // visita, y con varios workers en paralelo esa primera compilación puede
  // tardar más que el timeout de una aserción — no es flakiness real de la
  // app, es contención del compilador de dev. En CI contra un build de
  // producción esto no hace falta, pero aquí mantiene las pruebas estables.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 20000,
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
    env: { NEXT_PUBLIC_DEMO_MODE: 'true' },
    timeout: 60000,
  },
});
