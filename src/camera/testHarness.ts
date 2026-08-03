import type { Pose } from '../game/gameTypes';

/**
 * Costura de pruebas para el flujo end-to-end.
 *
 * Un juego que depende de una camara real y de un modelo de 18 MB no se puede
 * probar de punta a punta en CI. Esta costura permite a Playwright inyectar
 * poses sinteticas y saltarse getUserMedia.
 *
 * Doble candado para que no pueda activarse por accidente en produccion:
 *   1. la URL debe incluir `?e2e=1`,
 *   2. la propia pagina debe haber definido `window.__LVLR_E2E__`.
 * Un usuario normal nunca cumple la segunda condicion.
 */

export interface TestHarness {
  /** Poses del frame actual, en coordenadas normalizadas. */
  poses: () => Pose[];
}

declare global {
  interface Window {
    __LVLR_E2E__?: TestHarness;
  }
}

export function getTestHarness(): TestHarness | null {
  if (typeof window === 'undefined') return null;
  if (!new URLSearchParams(window.location.search).has('e2e')) return null;
  return window.__LVLR_E2E__ ?? null;
}
