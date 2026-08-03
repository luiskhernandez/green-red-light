import { expect, test, type Page } from '@playwright/test';
import { control, installPoseHarness } from './harness';

/**
 * Flujo de punta a punta con camara y pose simuladas.
 * Cubre los criterios de aceptacion del PRD que necesitan la app entera.
 */

/** Lleva la partida desde el inicio hasta la primera luz verde. */
async function startMatch(page: Page) {
  await page.goto('/?e2e=1&debug=true');
  await expect(page.getByTestId('screen-start')).toBeVisible();

  await page.getByTestId('start-button').click();

  // Calibracion: el jugador sintetico ya esta centrado y completo.
  await expect(page.getByTestId('screen-calibration')).toBeVisible();
  await expect(page.getByTestId('calibration-message')).toContainText('Quedate quieto');

  // Cuenta regresiva: exactamente 5, 4, 3, 2, 1.
  await expect(page.getByTestId('screen-countdown')).toBeVisible();
  for (const value of ['5', '4', '3', '2', '1']) {
    await expect(page.getByTestId('countdown-value')).toHaveText(value);
  }

  // La partida arranca sola despues del 1.
  await expect(page.getByTestId('screen-game')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installPoseHarness(page);
});

test('la camara no se pide antes de tocar Empezar', async ({ page }) => {
  await page.goto('/?e2e=1');
  await expect(page.getByTestId('screen-start')).toBeVisible();
  await expect(page.getByTestId('screen-start')).toContainText('Camina despacio. No corras.');
  await expect(page.getByTestId('screen-start')).toContainText('Juega acompañado por un adulto');
  // Nada de camara todavia.
  await expect(page.getByTestId('screen-calibration')).toHaveCount(0);
});

test('partida completa: calibrar, contar, jugar y llegar a la meta', async ({ page }) => {
  await startMatch(page);

  // Empieza con tres corazones y ambos botones disponibles.
  await expect(page.getByRole('img', { name: /Te quedan 3 corazones/ })).toBeVisible();
  await expect(page.getByTestId('stop-button')).toBeVisible();
  await expect(page.getByTestId('arrived-button')).toBeVisible();

  // Se distinguen las dos luces.
  await expect(page.getByTestId('light-word')).toHaveText(/Luz verde/i);
  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-phase', 'RED_DETECTION');
  await expect(page.getByTestId('light-word')).toHaveText(/Luz roja/i);

  // El adulto confirma la llegada.
  await page.getByTestId('arrived-button').click();
  await expect(page.getByTestId('screen-result')).toBeVisible();
  await expect(page.getByTestId('result-title')).toHaveText('¡Llegaste!');
  await expect(page.getByTestId('screen-result')).toHaveAttribute('data-reason', 'ARRIVED');
});

test('moverse en luz roja resta un corazon y la partida sigue', async ({ page }) => {
  await startMatch(page);
  const player = control(page);

  // Esperamos la fase que si penaliza (no el periodo de gracia).
  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-phase', 'RED_DETECTION');

  // Se mueve lo suficiente para pasar el umbral, sin salirse del cuadro.
  await player.setOffset(0.06);

  await expect(page.getByTestId('warning-message')).toHaveText('¡Te vi moverte!');
  await expect(page.getByRole('img', { name: /Te quedan 2 corazones/ })).toBeVisible();

  // Se queda quieto y el juego continua: nunca hay pantalla de derrota.
  await player.setOffset(0);
  await expect(page.getByTestId('light-word')).toHaveText(/Luz verde/i);
  await expect(page.getByTestId('screen-result')).toHaveCount(0);
});

test('una sola luz roja nunca quita mas de un corazon', async ({ page }) => {
  await startMatch(page);
  const player = control(page);

  await expect(page.getByTestId('screen-game')).toHaveAttribute('data-phase', 'RED_DETECTION');
  await player.setOffset(0.06);
  await expect(page.getByRole('img', { name: /Te quedan 2 corazones/ })).toBeVisible();

  // Sigue moviendose durante toda la advertencia: no cuesta mas corazones.
  await player.setOffset(0.09);
  await expect(page.getByTestId('light-word')).toHaveText(/Luz verde/i);
  await expect(page.getByRole('img', { name: /Te quedan 2 corazones/ })).toBeVisible();
});

test('si el jugador desaparece la partida se pausa y se recupera', async ({ page }) => {
  await startMatch(page);
  const player = control(page);

  await player.setVisible(false);
  await expect(page.getByTestId('screen-lost')).toBeVisible();
  await expect(page.getByTestId('screen-lost')).toContainText('No puedo verte');

  await player.setVisible(true);
  await expect(page.getByTestId('screen-game')).toBeVisible();
  // Vuelve con los mismos corazones: perderlo de vista no penaliza.
  await expect(page.getByRole('img', { name: /Te quedan 3 corazones/ })).toBeVisible();
});

test('pasar a segundo plano pausa, y al volver la partida continua', async ({ page }) => {
  await startMatch(page);

  // Simula que iPadOS manda la app al fondo.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('screen-paused')).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Se reanuda sola, con los corazones intactos.
  await expect(page.getByTestId('screen-game')).toBeVisible();
  await expect(page.getByRole('img', { name: /Te quedan 3 corazones/ })).toBeVisible();
});

test('el boton detener esta siempre disponible y vuelve al inicio', async ({ page }) => {
  await startMatch(page);
  await page.getByTestId('stop-button').click();
  await expect(page.getByTestId('screen-result')).toBeVisible();
  await page.getByTestId('home-button').click();
  await expect(page.getByTestId('screen-start')).toBeVisible();
});

test('durante la calibracion avisa si hay mas de una persona', async ({ page }) => {
  await page.goto('/?e2e=1');
  await control(page).setPeople(2);

  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('calibration-message')).toContainText(
    'Solo debe haber un jugador',
  );
});

test('los ajustes cambian la duracion de la partida', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-panel')).toBeVisible();
  await page.getByTestId('option-LONG').click();
  await expect(page.getByTestId('settings-panel')).toContainText('90 segundos');
  await page.getByTestId('settings-close').click();
  await expect(page.getByTestId('settings-panel')).toHaveCount(0);
});
