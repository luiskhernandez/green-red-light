import type { Page } from '@playwright/test';

/**
 * Camara y pose simuladas para las pruebas de flujo.
 *
 * La app expone la costura `window.__LVLR_E2E__` solo cuando la URL incluye
 * `?e2e=1` (ver src/camera/testHarness.ts). Aqui la rellenamos con un jugador
 * sintetico que podemos mover a voluntad:
 *
 *   setOffset(dx)  desplaza el cuerpo horizontalmente (0..1 del ancho)
 *   setPeople(n)   cuantas personas hay en el cuadro
 *   setVisible(b)  si se ve a alguien
 */

interface TestControl {
  setOffset: (value: number) => void;
  setPeople: (value: number) => void;
  setVisible: (value: boolean) => void;
}

type WindowWithControl = Window & { __LVLR_TEST: TestControl };

/** Debe llamarse antes de `goto` para que la app la vea al arrancar. */
export async function installPoseHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const LM = {
      NOSE: 0,
      LEFT_SHOULDER: 11,
      RIGHT_SHOULDER: 12,
      LEFT_HIP: 23,
      RIGHT_HIP: 24,
      LEFT_KNEE: 25,
      RIGHT_KNEE: 26,
      LEFT_ANKLE: 27,
      RIGHT_ANKLE: 28,
    };

    const state = { offset: 0, people: 1, visible: true };

    /** Cuerpo de pie centrado en cx, con `scale` como distancia hombro-cadera. */
    function buildPose(cx: number, scale: number) {
      const cy = 0.5;
      const halfShoulder = scale * 0.55;
      const halfHip = scale * 0.4;
      const pose = Array.from({ length: 33 }, () => ({ x: cx, y: cy, z: 0, visibility: 0.95 }));
      const set = (i: number, x: number, y: number) => {
        pose[i] = { x, y, z: 0, visibility: 0.95 };
      };
      set(LM.NOSE, cx, cy - scale * 1.4);
      set(LM.LEFT_SHOULDER, cx - halfShoulder, cy - scale * 0.5);
      set(LM.RIGHT_SHOULDER, cx + halfShoulder, cy - scale * 0.5);
      set(LM.LEFT_HIP, cx - halfHip, cy + scale * 0.5);
      set(LM.RIGHT_HIP, cx + halfHip, cy + scale * 0.5);
      set(LM.LEFT_KNEE, cx - halfHip, cy + scale * 1.4);
      set(LM.RIGHT_KNEE, cx + halfHip, cy + scale * 1.4);
      set(LM.LEFT_ANKLE, cx - halfHip, cy + scale * 2.2);
      set(LM.RIGHT_ANKLE, cx + halfHip, cy + scale * 2.2);
      return pose;
    }

    const target = window as unknown as Record<string, unknown>;

    target.__LVLR_E2E__ = {
      poses() {
        if (!state.visible) return [];
        const player = buildPose(0.5 + state.offset, 0.2);
        // Segunda persona: pequeña (lejos) y al borde, como un adulto de fondo.
        return state.people > 1 ? [player, buildPose(0.9, 0.07)] : [player];
      },
    };

    target.__LVLR_TEST = {
      setOffset: (value: number) => {
        state.offset = value;
      },
      setPeople: (value: number) => {
        state.people = value;
      },
      setVisible: (value: boolean) => {
        state.visible = value;
      },
    };
  });
}

/** Mando a distancia del jugador sintetico desde el lado de Node. */
export function control(page: Page) {
  return {
    setOffset: (value: number) =>
      page.evaluate((v) => (window as unknown as WindowWithControl).__LVLR_TEST.setOffset(v), value),
    setPeople: (value: number) =>
      page.evaluate((v) => (window as unknown as WindowWithControl).__LVLR_TEST.setPeople(v), value),
    setVisible: (value: boolean) =>
      page.evaluate((v) => (window as unknown as WindowWithControl).__LVLR_TEST.setVisible(v), value),
  };
}
