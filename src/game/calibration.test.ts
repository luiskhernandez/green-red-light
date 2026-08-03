import { describe, expect, it } from 'vitest';
import { checkCalibration } from './calibration';
import { computeBodyMetrics } from './movementScoring';
import { LM, type Pose } from './gameTypes';

function makePose(options: {
  cx?: number;
  scale?: number;
  hideKnees?: boolean;
  hideHead?: boolean;
  visibility?: number;
} = {}): Pose {
  const { cx = 0.5, scale = 0.2, hideKnees = false, hideHead = false, visibility = 0.95 } = options;
  const cy = 0.5;
  const halfShoulder = scale * 0.55;
  const halfHip = scale * 0.4;
  const pose: Pose = Array.from({ length: 33 }, () => ({ x: cx, y: cy, z: 0, visibility }));
  const set = (i: number, x: number, y: number, v = visibility) => {
    pose[i] = { x, y, z: 0, visibility: v };
  };
  set(LM.NOSE, cx, cy - scale * 1.4, hideHead ? 0.1 : visibility);
  set(LM.LEFT_SHOULDER, cx - halfShoulder, cy - scale * 0.5);
  set(LM.RIGHT_SHOULDER, cx + halfShoulder, cy - scale * 0.5);
  set(LM.LEFT_HIP, cx - halfHip, cy + scale * 0.5);
  set(LM.RIGHT_HIP, cx + halfHip, cy + scale * 0.5);
  const kneeVisibility = hideKnees ? 0.1 : visibility;
  set(LM.LEFT_KNEE, cx - halfHip, cy + scale * 1.4, kneeVisibility);
  set(LM.RIGHT_KNEE, cx + halfHip, cy + scale * 1.4, kneeVisibility);
  set(LM.LEFT_ANKLE, cx - halfHip, cy + scale * 2.2);
  set(LM.RIGHT_ANKLE, cx + halfHip, cy + scale * 2.2);
  return pose;
}

function candidate(options: Parameters<typeof makePose>[0] = {}) {
  const pose = makePose(options);
  return { pose, metrics: computeBodyMetrics(pose)! };
}

describe('checkCalibration', () => {
  it('sin nadie delante pide que se coloquen', () => {
    expect(checkCalibration([], null).issue).toBe('NO_PLAYER');
  });

  it('con dos personas avisa que solo debe haber un jugador', () => {
    const a = candidate({ cx: 0.4 });
    const b = candidate({ cx: 0.7 });
    const result = checkCalibration([a, b], a);
    expect(result.issue).toBe('MULTIPLE_PEOPLE');
    expect(result.message).toContain('un jugador');
  });

  it('no continua si el cuerpo esta cortado', () => {
    const c = candidate({ hideKnees: true });
    const result = checkCalibration([c], c);
    expect(result.issue).toBe('PARTIAL_BODY');
    expect(result.missingParts).toContain('piernas');
  });

  it('detecta que falta la cabeza', () => {
    const c = candidate({ hideHead: true });
    const result = checkCalibration([c], c);
    expect(result.issue).toBe('PARTIAL_BODY');
    expect(result.missingParts).toContain('cabeza');
  });

  it('pide centrarse si el jugador esta en el borde', () => {
    const c = candidate({ cx: 0.05 });
    expect(checkCalibration([c], c).issue).toBe('OUT_OF_ZONE');
  });

  it('avisa cuando la confianza es baja', () => {
    const c = candidate({ visibility: 0.55 });
    expect(checkCalibration([c], c).issue).toBe('LOW_CONFIDENCE');
  });

  it('acepta un jugador centrado y completo', () => {
    const c = candidate({ cx: 0.5, scale: 0.18 });
    const result = checkCalibration([c], c);
    expect(result.issue).toBe('READY');
    expect(result.message).toContain('Quedate quieto');
  });
});
