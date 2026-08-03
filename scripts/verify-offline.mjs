/**
 * Comprueba que el juego funciona sin conexion despues de la primera carga.
 *
 * Uso:
 *   npm run build
 *   npm run preview -- --port 4188
 *   node scripts/verify-offline.mjs http://127.0.0.1:4188/
 *
 * Usa Chromium con camara falsa, asi que ejecuta el mismo camino que el iPad:
 * getUserMedia real, wasm real y modelo real, todo desde el propio origen.
 */
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4188/';

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  permissions: ['camera'],
  viewport: { width: 1180, height: 820 },
});
const page = await context.newPage();

const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('requestfailed', (request) =>
  problems.push(`requestfailed: ${request.url()} (${request.failure()?.errorText})`),
);

/** Espera a que la inferencia de pose este realmente produciendo frames. */
async function waitForInference() {
  await page.waitForFunction(
    () => {
      const text = document.querySelector('[data-testid=debug-overlay]')?.textContent ?? '';
      const match = text.match(/inferencia\s+(\d+) fps/);
      return !!match && Number(match[1]) > 0;
    },
    undefined,
    { timeout: 60_000 },
  );
}

console.log(`1. Primera carga con red: ${url}`);
await page.goto(`${url}?debug=true`);
await page.getByTestId('start-button').click();
await waitForInference();

const caches = await page.evaluate(async () => {
  const result = {};
  for (const name of await window.caches.keys()) {
    result[name] = (await (await window.caches.open(name)).keys()).length;
  }
  return result;
});
console.log('   caches:', JSON.stringify(caches));

console.log('2. Recarga SIN conexion');
await context.setOffline(true);
problems.length = 0;
await page.reload();
await page.waitForSelector('[data-testid=screen-start]', { timeout: 30_000 });
await page.getByTestId('start-button').click();
await waitForInference();

const overlay = (await page.getByTestId('debug-overlay').textContent()) ?? '';
console.log('  ', overlay.split('\n').find((line) => line.includes('inferencia'))?.trim());

await browser.close();

if (problems.length > 0) {
  console.error('FALLO sin conexion:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('OK: el juego arranca y detecta poses sin conexion.');
