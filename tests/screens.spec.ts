import { test, type Page } from '@playwright/test';
import { installPoseHarness, control } from './harness';

/** Captura una imagen de cada pantalla para revisarlas de un vistazo. */

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screens/${name}.png` });
}

test.beforeEach(async ({ page }) => {
  await installPoseHarness(page);
});

test('capturas de todas las pantallas', async ({ page }) => {
  await page.goto('/?e2e=1');
  await shot(page, '01-start');

  await page.getByTestId('settings-button').click();
  await shot(page, '02-settings');
  await page.getByTestId('settings-close').click();

  await page.getByTestId('start-button').click();
  await page.waitForSelector('[data-testid=screen-calibration]');
  await shot(page, '03-calibration');

  await page.waitForFunction(
    () => !!document.querySelector('[data-testid=screen-countdown]'),
    undefined,
    { timeout: 20000 },
  );
  await page.waitForTimeout(2200);
  await shot(page, '04-countdown');

  await page.waitForSelector('[data-testid=screen-game][data-phase=GREEN]', { timeout: 20000 });
  await shot(page, '05-green');

  await page.waitForSelector('[data-testid=screen-game][data-phase=RED_DETECTION]', {
    timeout: 20000,
  });
  await shot(page, '06-red');

  const player = control(page);
  await player.setOffset(0.06);
  await page.waitForSelector('[data-testid=warning-message]', { timeout: 20000 });
  await shot(page, '07-warning');
  await player.setOffset(0);

  await player.setVisible(false);
  await page.waitForSelector('[data-testid=screen-lost]', { timeout: 20000 });
  await shot(page, '08-lost');
  await player.setVisible(true);

  await page.waitForSelector('[data-testid=screen-game]', { timeout: 20000 });
  await page.getByTestId('arrived-button').click();
  await page.waitForSelector('[data-testid=screen-result]');
  await shot(page, '09-result');
});
