import { defineConfig, devices } from '@playwright/test';

/**
 * El flujo E2E usa la costura de pruebas (?e2e=1) para inyectar poses
 * sinteticas: no hace falta camara real ni descargar el modelo.
 */
export default defineConfig({
  testDir: './tests',
  // Una partida completa dura decenas de segundos por diseño.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5175',
    // iPad horizontal, que es el dispositivo objetivo.
    viewport: { width: 1180, height: 820 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
