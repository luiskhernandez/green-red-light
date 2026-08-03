import { describe, expect, it } from 'vitest';
import {
  computeBodyMetrics,
  createReferencePose,
  median,
  MovementTracker,
  scoreMovement,
} from './movementScoring';
import { MIN_PENALTY_CONFIDENCE, MOVEMENT_THRESHOLD } from './gameConfig';
import { LM, type Pose } from './gameTypes';

/**
 * Construye una pose sintetica de pie, centrada en (cx, cy), con `scale` como
 * distancia hombro-cadera. Sirve para simular a un niño mas cerca o mas lejos
 * de la camara sin necesitar video real.
 */
function makePose(options: {
  cx?: number;
  cy?: number;
  scale?: number;
  visibility?: number;
  /** Desplazamiento adicional solo de los brazos (muñecas). */
  armShift?: number;
} = {}): Pose {
  const { cx = 0.5, cy = 0.5, scale = 0.2, visibility = 0.95, armShift = 0 } = options;
  const halfShoulder = scale * 0.55;
  const halfHip = scale * 0.4;

  const pose: Pose = Array.from({ length: 33 }, () => ({
    x: cx,
    y: cy,
    z: 0,
    visibility,
  }));

  const set = (index: number, x: number, y: number) => {
    pose[index] = { x, y, z: 0, visibility };
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

  // Muñecas: se mueven aparte para comprobar que se ignoran.
  set(15, cx - halfShoulder - 0.02 + armShift, cy + scale * 0.2);
  set(16, cx + halfShoulder + 0.02 + armShift, cy + scale * 0.2);

  return pose;
}

describe('median', () => {
  it('funciona con listas pares e impares', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('computeBodyMetrics', () => {
  it('calcula centro y escala del torso', () => {
    const metrics = computeBodyMetrics(makePose({ cx: 0.5, cy: 0.5, scale: 0.2 }));
    expect(metrics).not.toBeNull();
    expect(metrics!.torsoCenter.x).toBeCloseTo(0.5, 5);
    expect(metrics!.torsoCenter.y).toBeCloseTo(0.5, 5);
    expect(metrics!.bodyScale).toBeGreaterThan(0);
  });

  it('devuelve null si el torso no es visible', () => {
    const pose = makePose({ visibility: 0.2 });
    expect(computeBodyMetrics(pose)).toBeNull();
  });

  it('la escala crece cuando el jugador se acerca', () => {
    const far = computeBodyMetrics(makePose({ scale: 0.1 }))!;
    const near = computeBodyMetrics(makePose({ scale: 0.3 }))!;
    expect(near.bodyScale).toBeGreaterThan(far.bodyScale);
  });
});

describe('scoreMovement normalizado', () => {
  it('una pose identica puntua cero', () => {
    const reference = createReferencePose(makePose())!;
    const result = scoreMovement(reference, makePose());
    expect(result).not.toBeNull();
    expect(result!.score).toBeCloseTo(0, 6);
  });

  it('la misma distancia recorrida puntua igual de lejos que de cerca', () => {
    // Cerca: escala 0.3, se mueve 0.15 (media escala corporal).
    const near = scoreMovement(
      createReferencePose(makePose({ cx: 0.5, scale: 0.3 }))!,
      makePose({ cx: 0.5 + 0.15, scale: 0.3 }),
    )!;
    // Lejos: escala 0.1, se mueve 0.05 (tambien media escala corporal).
    const far = scoreMovement(
      createReferencePose(makePose({ cx: 0.5, scale: 0.1 }))!,
      makePose({ cx: 0.5 + 0.05, scale: 0.1 }),
    )!;

    // Esa es toda la razon de normalizar: la sensibilidad no depende de la
    // distancia al iPad.
    expect(far.score).toBeCloseTo(near.score, 5);
  });

  it('un movimiento mas grande puntua mas alto', () => {
    const reference = createReferencePose(makePose({ cx: 0.5, scale: 0.2 }))!;
    const small = scoreMovement(reference, makePose({ cx: 0.51, scale: 0.2 }))!;
    const big = scoreMovement(reference, makePose({ cx: 0.62, scale: 0.2 }))!;
    expect(big.score).toBeGreaterThan(small.score);
  });

  it('ignora manos y muñecas', () => {
    const reference = createReferencePose(makePose())!;
    // Solo se movieron las muñecas: 8 cm es un gesto de brazo evidente.
    const result = scoreMovement(reference, makePose({ armShift: 0.08 }))!;
    expect(result.score).toBeCloseTo(0, 6);
  });

  it('un balanceo natural queda por debajo del umbral normal', () => {
    const reference = createReferencePose(makePose({ cx: 0.5, scale: 0.2 }))!;
    // 1 cm normalizado sobre un cuerpo de 0.2: pequeño balanceo.
    const swing = scoreMovement(reference, makePose({ cx: 0.505, scale: 0.2 }))!;
    expect(swing.score).toBeLessThan(MOVEMENT_THRESHOLD.NORMAL);
  });

  it('acercarse a la camara cuenta como movimiento', () => {
    const reference = createReferencePose(makePose({ scale: 0.18 }))!;
    // Mismo centro, cuerpo mas grande: el niño avanzo hacia el iPad.
    const closer = scoreMovement(reference, makePose({ scale: 0.26 }))!;
    expect(closer.score).toBeGreaterThan(MOVEMENT_THRESHOLD.NORMAL);
  });

  it('devuelve null si la pose nueva no es utilizable', () => {
    const reference = createReferencePose(makePose())!;
    expect(scoreMovement(reference, makePose({ visibility: 0.1 }))).toBeNull();
  });

  it('la referencia es una copia: mutar la pose original no la afecta', () => {
    const pose = makePose();
    const reference = createReferencePose(pose)!;
    pose[LM.LEFT_HIP] = { x: 0.9, y: 0.9, z: 0, visibility: 0.95 };
    const result = scoreMovement(reference, makePose())!;
    expect(result.score).toBeCloseTo(0, 6);
  });
});

describe('MovementTracker', () => {
  const threshold = MOVEMENT_THRESHOLD.NORMAL;
  const required = 3;

  function trackerWith(scores: number[], confidence = 0.9) {
    const tracker = new MovementTracker(threshold, required, MIN_PENALTY_CONFIDENCE);
    const results = scores.map((score) => tracker.push({ score, confidence }));
    return { tracker, results };
  }

  it('nunca penaliza por un solo frame', () => {
    const { results } = trackerWith([0.9]);
    expect(results).toEqual([false]);
  });

  it('exige el numero configurado de analisis consecutivos', () => {
    const { results } = trackerWith([0.5, 0.5, 0.5, 0.5, 0.5]);
    // El primer frame solo llena el historial (no hay nada que suavizar);
    // desde el segundo se cuentan los 3 analisis consecutivos requeridos.
    expect(results).toEqual([false, false, false, true, true]);
  });

  it('un pico aislado de ruido no penaliza', () => {
    const { results } = trackerWith([0.01, 0.01, 0.9, 0.01, 0.01, 0.01]);
    expect(results.some(Boolean)).toBe(false);
  });

  it('la mediana filtra el ruido pero deja pasar el movimiento sostenido', () => {
    const tracker = new MovementTracker(threshold, required, MIN_PENALTY_CONFIDENCE);
    const sustained = [0.4, 0.42, 0.38, 0.45, 0.41, 0.43];
    const hits = sustained.map((score) => tracker.push({ score, confidence: 0.9 }));
    expect(hits.at(-1)).toBe(true);
    expect(tracker.smoothedScore).toBeGreaterThan(threshold);
  });

  it('no penaliza con confianza baja', () => {
    const { results } = trackerWith([0.9, 0.9, 0.9, 0.9, 0.9], 0.3);
    expect(results.some(Boolean)).toBe(false);
  });

  it('un frame sin datos corta la racha pero no borra el historial', () => {
    const tracker = new MovementTracker(threshold, required, MIN_PENALTY_CONFIDENCE);
    tracker.push({ score: 0.5, confidence: 0.9 });
    tracker.push({ score: 0.5, confidence: 0.9 });
    tracker.push({ score: 0.5, confidence: 0.9 });
    tracker.push(null);
    expect(tracker.consecutiveOverThreshold).toBe(0);
    // El historial sigue ahi: dos frames buenos bastan para volver a acumular.
    expect(tracker.push({ score: 0.5, confidence: 0.9 })).toBe(false);
    expect(tracker.push({ score: 0.5, confidence: 0.9 })).toBe(false);
    expect(tracker.push({ score: 0.5, confidence: 0.9 })).toBe(true);
  });

  it('reset limpia todo', () => {
    const { tracker } = trackerWith([0.5, 0.5, 0.5, 0.5]);
    tracker.reset();
    expect(tracker.consecutiveOverThreshold).toBe(0);
    expect(tracker.score).toBe(0);
    expect(tracker.push({ score: 0.9, confidence: 0.9 })).toBe(false);
  });

  it('la sensibilidad alta detecta movimientos que la baja perdona', () => {
    const moderate = { score: 0.12, confidence: 0.9 };
    const strict = new MovementTracker(MOVEMENT_THRESHOLD.HIGH, 3, MIN_PENALTY_CONFIDENCE);
    const lenient = new MovementTracker(MOVEMENT_THRESHOLD.LOW, 4, MIN_PENALTY_CONFIDENCE);

    let strictHit = false;
    let lenientHit = false;
    for (let i = 0; i < 6; i += 1) {
      strictHit = strict.push(moderate) || strictHit;
      lenientHit = lenient.push(moderate) || lenientHit;
    }
    expect(strictHit).toBe(true);
    expect(lenientHit).toBe(false);
  });
});
