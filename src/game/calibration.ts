import { CALIBRATION_ZONE, MIN_LANDMARK_VISIBILITY, MIN_POSE_CONFIDENCE } from './gameConfig';
import { LM, type CalibrationIssue, type Pose } from './gameTypes';
import type { PoseCandidate } from './playerTracking';

/**
 * Requisitos para poder empezar (PRD estado 2).
 *
 * Todo esto es una funcion pura sobre las poses del frame, para poder probarlo
 * sin camara y para que la pantalla de calibracion solo tenga que pintar el
 * mensaje que corresponde.
 */

const REQUIRED_PARTS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['cabeza', [LM.NOSE]],
  ['hombros', [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER]],
  ['cadera', [LM.LEFT_HIP, LM.RIGHT_HIP]],
  ['piernas', [LM.LEFT_KNEE, LM.RIGHT_KNEE]],
];

export interface CalibrationCheck {
  issue: CalibrationIssue;
  message: string;
  /** Partes del cuerpo que aun no vemos bien. */
  missingParts: string[];
}

const MESSAGES: Record<CalibrationIssue, string> = {
  NO_PLAYER: 'Buscando un jugador. Colocate frente al iPad.',
  MULTIPLE_PEOPLE: 'Solo debe haber un jugador frente a la camara.',
  PARTIAL_BODY: 'Alejate un poco para que veamos tu cuerpo completo.',
  OUT_OF_ZONE: 'Ponte en el centro de la zona marcada.',
  LOW_CONFIDENCE: 'No te veo bien. Prueba con mas luz o cambia el iPad de lugar.',
  READY: 'Jugador encontrado. Quedate quieto.',
};

function hasPart(pose: Pose, indices: readonly number[]): boolean {
  return indices.every((i) => (pose[i]?.visibility ?? 0) >= MIN_LANDMARK_VISIBILITY);
}

export function checkCalibration(
  candidates: PoseCandidate[],
  chosen: PoseCandidate | null,
): CalibrationCheck {
  if (candidates.length === 0 || !chosen) {
    return { issue: 'NO_PLAYER', message: MESSAGES.NO_PLAYER, missingParts: [] };
  }

  if (candidates.length > 1) {
    return { issue: 'MULTIPLE_PEOPLE', message: MESSAGES.MULTIPLE_PEOPLE, missingParts: [] };
  }

  const missingParts = REQUIRED_PARTS.filter(([, indices]) => !hasPart(chosen.pose, indices)).map(
    ([name]) => name,
  );
  if (missingParts.length > 0) {
    return { issue: 'PARTIAL_BODY', message: MESSAGES.PARTIAL_BODY, missingParts };
  }

  if (chosen.metrics.confidence < MIN_POSE_CONFIDENCE) {
    return { issue: 'LOW_CONFIDENCE', message: MESSAGES.LOW_CONFIDENCE, missingParts: [] };
  }

  const { torsoCenter } = chosen.metrics;
  const inZone =
    torsoCenter.x >= CALIBRATION_ZONE.minX &&
    torsoCenter.x <= CALIBRATION_ZONE.maxX &&
    torsoCenter.y >= CALIBRATION_ZONE.minY &&
    torsoCenter.y <= CALIBRATION_ZONE.maxY;
  if (!inZone) {
    return { issue: 'OUT_OF_ZONE', message: MESSAGES.OUT_OF_ZONE, missingParts: [] };
  }

  return { issue: 'READY', message: MESSAGES.READY, missingParts: [] };
}
