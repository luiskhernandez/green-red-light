import { describe, expect, it } from 'vitest';
import {
  blendSignature,
  matchScore,
  pickCalibrationCandidate,
  selectPlayerPose,
  signatureFrom,
  toCandidates,
} from './playerTracking';
import { computeBodyMetrics } from './movementScoring';
import { LM, type Pose } from './gameTypes';

function makePose(cx: number, cy: number, scale: number, visibility = 0.95): Pose {
  const halfShoulder = scale * 0.55;
  const halfHip = scale * 0.4;
  const pose: Pose = Array.from({ length: 33 }, () => ({ x: cx, y: cy, z: 0, visibility }));
  const set = (i: number, x: number, y: number) => {
    pose[i] = { x, y, z: 0, visibility };
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

function candidateOf(cx: number, cy: number, scale: number) {
  const pose = makePose(cx, cy, scale);
  return { pose, metrics: computeBodyMetrics(pose)! };
}

describe('toCandidates', () => {
  it('descarta poses sin torso utilizable', () => {
    const good = makePose(0.5, 0.5, 0.2);
    const bad = makePose(0.2, 0.5, 0.2, 0.1);
    expect(toCandidates([good, bad])).toHaveLength(1);
  });
});

describe('pickCalibrationCandidate', () => {
  it('elige la persona mas grande y mas centrada', () => {
    const small = candidateOf(0.2, 0.5, 0.08);
    const big = candidateOf(0.5, 0.5, 0.24);
    const chosen = pickCalibrationCandidate([small, big]);
    expect(chosen?.metrics.bodyScale).toBeCloseTo(big.metrics.bodyScale, 5);
  });

  it('devuelve null si no hay nadie', () => {
    expect(pickCalibrationCandidate([])).toBeNull();
  });
});

describe('seguimiento del jugador', () => {
  const player = candidateOf(0.5, 0.5, 0.2);
  const signature = signatureFrom(player.metrics);

  it('reconoce al mismo jugador en el mismo sitio', () => {
    expect(matchScore(signature, player)).toBeGreaterThan(0.9);
  });

  it('lo sigue reconociendo despues de caminar un poco', () => {
    const moved = candidateOf(0.58, 0.5, 0.22);
    const match = selectPlayerPose([moved], signature, signature.center);
    expect(match).not.toBeNull();
  });

  it('un adulto que entra al fondo no reemplaza al jugador', () => {
    // Persona pequeña (lejos) y en el borde opuesto.
    const stranger = candidateOf(0.9, 0.35, 0.06);
    const match = selectPlayerPose([stranger], signature, signature.center);
    expect(match).toBeNull();
  });

  it('con dos personas elige la que coincide con el jugador', () => {
    const stranger = candidateOf(0.15, 0.45, 0.09);
    const player2 = candidateOf(0.53, 0.5, 0.21);
    const match = selectPlayerPose([stranger, player2], signature, signature.center);
    expect(match).not.toBeNull();
    expect(match!.candidate.metrics.torsoCenter.x).toBeCloseTo(0.53, 2);
  });

  it('prefiere la pose mas cercana a la posicion anterior', () => {
    // Dos cuerpos casi idénticos: decide la proximidad.
    const near = candidateOf(0.52, 0.5, 0.2);
    const far = candidateOf(0.95, 0.5, 0.2);
    const match = selectPlayerPose([far, near], signature, { x: 0.5, y: 0.5 });
    expect(match!.candidate.metrics.torsoCenter.x).toBeCloseTo(0.52, 2);
  });

  it('sin candidatos no hay match (el juego se pausa)', () => {
    expect(selectPlayerPose([], signature, signature.center)).toBeNull();
  });

  it('la firma mezclada acompaña al jugador cuando se acerca', () => {
    const closer = signatureFrom(candidateOf(0.5, 0.5, 0.3).metrics);
    const blended = blendSignature(signature, closer, 0.5);
    expect(blended.bodyScale).toBeGreaterThan(signature.bodyScale);
    expect(blended.bodyScale).toBeLessThan(closer.bodyScale);
    // La posicion siempre se actualiza del todo.
    expect(blended.center).toEqual(closer.center);
  });

  it('tras varias mezclas sigue reconociendo al jugador que se acerco mucho', () => {
    let current = signature;
    let position = 0.2;
    // Simula al niño acercandose de a poco durante una partida.
    for (let i = 0; i < 12; i += 1) {
      position += 0.02;
      const step = candidateOf(0.5, 0.5, position);
      const match = selectPlayerPose([step], current, current.center);
      expect(match, `paso ${i} con escala ${position.toFixed(2)}`).not.toBeNull();
      current = blendSignature(current, signatureFrom(step.metrics));
    }
  });
});
