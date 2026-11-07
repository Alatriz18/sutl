import { defineConfig, devices } from '@playwright/test';

// E2e contra el BACKEND REAL (no el modo demo): requiere el stack local arriba
// (docker compose up -d postgres mongo redis; backend en :3001 con la base
// sembrada). Se corre con `npm run test:e2e:real`. Si el puerto 3002 lo ocupa
// un `next dev` en modo demo, páralo antes: aquí se levanta el frontend en
// modo real.
export default defineConfig({
  testDir: './e2e-real',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 30000,
  globalSetup: './e2e-real/global-setup.ts',
  use: { baseURL: 'http://localhost:3002', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_DEMO_MODE: 'false', NEXT_PUBLIC_API_URL: 'http://localhost:3001/api' },
    timeout: 90000,
  },
});
