import { expect, test, type Page } from '@playwright/test';

/**
 * Comprueba que la eleccion de camara llega de verdad a getUserMedia.
 *
 * Aqui NO usamos la costura `?e2e=1`: esa se salta getUserMedia por completo,
 * asi que no probaria nada. En su lugar sustituimos getUserMedia por un doble
 * que apunta las restricciones pedidas y devuelve un stream de un <canvas>.
 */

/** Instala un getUserMedia falso que registra las restricciones recibidas. */
async function installFakeCamera(page: Page) {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as Record<string, unknown>).__GUM_CALLS = calls;

    navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      calls.push(constraints?.video);
      // Un canvas animado sirve como camara: tiene tamaño y frames reales.
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      let tick = 0;
      setInterval(() => {
        tick += 4;
        ctx.fillStyle = `hsl(${tick % 360} 60% 45%)`;
        ctx.fillRect(0, 0, 640, 480);
      }, 60);
      return (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream })
        .captureStream(30);
    };
  });
}

function facingModes(page: Page) {
  return page.evaluate(() =>
    ((window as unknown as { __GUM_CALLS: { facingMode?: { ideal?: string } }[] }).__GUM_CALLS ?? [])
      .map((video) => video?.facingMode?.ideal),
  );
}

test.beforeEach(async ({ page }) => {
  await installFakeCamera(page);
});

test('por defecto pide la camara trasera', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('screen-calibration')).toBeVisible();

  expect(await facingModes(page)).toEqual(['environment']);
  // Sin espejo: la trasera se ve tal cual.
  await expect(page.getByTestId('camera-stage')).toHaveAttribute('data-mirrored', 'false');
});

test('el boton de la calibracion cambia a la camara frontal y la refleja', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('screen-calibration')).toBeVisible();

  await page.getByTestId('flip-camera-button').click();

  // Se reabre el stream, ahora con 'user'.
  await expect
    .poll(() => facingModes(page), { timeout: 15_000 })
    .toEqual(['environment', 'user']);

  // La frontal se muestra en espejo, como cualquier app de selfie.
  await expect(page.getByTestId('camera-stage')).toHaveAttribute('data-mirrored', 'true');
  await expect(page.getByTestId('flip-camera-button')).toContainText('trasera');

  // Y se puede volver atras.
  await page.getByTestId('flip-camera-button').click();
  await expect
    .poll(() => facingModes(page), { timeout: 15_000 })
    .toEqual(['environment', 'user', 'environment']);
  await expect(page.getByTestId('camera-stage')).toHaveAttribute('data-mirrored', 'false');
});

test('la eleccion de camara se recuerda entre sesiones', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('settings-button').click();
  await page.getByTestId('option-FRONT').click();
  await expect(page.getByTestId('settings-panel')).toContainText('te ves en la pantalla');
  await page.getByTestId('settings-close').click();

  // Recarga completa: el ajuste vive en localStorage.
  await page.reload();
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('screen-calibration')).toBeVisible();

  expect(await facingModes(page)).toEqual(['user']);
});
