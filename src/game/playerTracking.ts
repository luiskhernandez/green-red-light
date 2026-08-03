import { PLAYER_MATCH_THRESHOLD } from './gameConfig';
import { computeBodyMetrics } from './movementScoring';
import type { BodyMetrics, PlayerSignature, Point, Pose } from './gameTypes';

/**
 * Seguimiento de identidad del jugador (PRD seccion 9).
 *
 * No usamos rostro ni biometria. Solo geometria: proporciones del cuerpo,
 * tamaño en pantalla y cercania a la posicion anterior. La identidad vive
 * unicamente durante la partida y nunca se persiste.
 */

export interface PoseCandidate {
  pose: Pose;
  metrics: BodyMetrics;
}

/** Filtra las poses del frame quedando solo las que tienen torso utilizable. */
export function toCandidates(poses: Pose[]): PoseCandidate[] {
  const candidates: PoseCandidate[] = [];
  for (const pose of poses) {
    const metrics = computeBodyMetrics(pose);
    if (metrics) candidates.push({ pose, metrics });
  }
  return candidates;
}

export function signatureFrom(metrics: BodyMetrics): PlayerSignature {
  return {
    shoulderWidth: metrics.shoulderWidth,
    hipWidth: metrics.hipWidth,
    bodyScale: metrics.bodyScale,
    bodyHeight: metrics.bodyHeight,
    boundingBoxArea: metrics.boundingBox.width * metrics.boundingBox.height,
    center: { ...metrics.torsoCenter },
  };
}

/**
 * Mezcla la firma vieja con la nueva para que el jugador pueda acercarse a la
 * camara sin dejar de "ser el mismo". alpha bajo = memoria larga.
 */
export function blendSignature(
  previous: PlayerSignature,
  next: PlayerSignature,
  alpha = 0.15,
): PlayerSignature {
  const mix = (a: number, b: number) => a * (1 - alpha) + b * alpha;
  return {
    shoulderWidth: mix(previous.shoulderWidth, next.shoulderWidth),
    hipWidth: mix(previous.hipWidth, next.hipWidth),
    bodyScale: mix(previous.bodyScale, next.bodyScale),
    bodyHeight: mix(previous.bodyHeight, next.bodyHeight),
    boundingBoxArea: mix(previous.boundingBoxArea, next.boundingBoxArea),
    // La posicion siempre es la nueva: el jugador se mueve, eso es el juego.
    center: { ...next.center },
  };
}

/** Similitud de dos magnitudes positivas: 1 identicas, 0 muy distintas. */
function ratioSimilarity(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return Math.min(a, b) / Math.max(a, b);
}

/**
 * Similitud (0..1) entre una pose candidata y la firma del jugador.
 *
 * lastCenter permite premiar la pose mas cercana a donde estaba el jugador:
 * si un adulto cruza al fondo, su centro estara lejos y su tamaño distinto.
 */
export function matchScore(
  signature: PlayerSignature,
  candidate: PoseCandidate,
  lastCenter?: Point,
): number {
  const candidateSignature = signatureFrom(candidate.metrics);

  // Proporciones internas del cuerpo: casi invariantes a la distancia.
  const shoulderToHip = ratioSimilarity(
    signature.shoulderWidth / Math.max(signature.hipWidth, 1e-4),
    candidateSignature.shoulderWidth / Math.max(candidateSignature.hipWidth, 1e-4),
  );
  const heightToScale = ratioSimilarity(
    signature.bodyHeight / Math.max(signature.bodyScale, 1e-4),
    candidateSignature.bodyHeight / Math.max(candidateSignature.bodyScale, 1e-4),
  );

  // Tamaño absoluto: algo tolerante, porque el jugador camina hacia la camara
  // y su cuerpo crece en pantalla durante la partida.
  const size = ratioSimilarity(signature.bodyScale, candidateSignature.bodyScale);
  const tolerantSize = Math.min(1, size + 0.2);

  // Proximidad a la ultima posicion conocida, medida en "cuerpos".
  // Es el discriminante mas fuerte: dos personas con proporciones parecidas
  // solo se distinguen por donde estan.
  const reference = lastCenter ?? signature.center;
  const bodies =
    Math.hypot(
      reference.x - candidateSignature.center.x,
      reference.y - candidateSignature.center.y,
    ) / Math.max(signature.bodyScale, 1e-4);
  const proximity = Math.max(0, 1 - bodies / 2.5);

  return (
    0.15 * shoulderToHip + 0.15 * heightToScale + 0.3 * tolerantSize + 0.4 * proximity
  );
}

export interface PlayerMatch {
  candidate: PoseCandidate;
  score: number;
}

/**
 * Elige la pose que corresponde al jugador seleccionado.
 * Devuelve null si ninguna coincide con suficiente confianza: en ese caso el
 * juego se pausa en vez de adoptar a otra persona (criterio de aceptacion).
 */
export function selectPlayerPose(
  candidates: PoseCandidate[],
  signature: PlayerSignature,
  lastCenter?: Point,
  threshold = PLAYER_MATCH_THRESHOLD,
): PlayerMatch | null {
  let best: PlayerMatch | null = null;
  for (const candidate of candidates) {
    const score = matchScore(signature, candidate, lastCenter);
    if (!best || score > best.score) best = { candidate, score };
  }
  if (!best || best.score < threshold) return null;
  return best;
}

/**
 * Antes de que haya jugador elegido: la persona mas grande y mas centrada.
 * "Mas grande" es un proxy razonable de "mas cerca de la camara".
 */
export function pickCalibrationCandidate(
  candidates: PoseCandidate[],
): PoseCandidate | null {
  let best: PoseCandidate | null = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const centerBias = 1 - Math.abs(candidate.metrics.torsoCenter.x - 0.5);
    const score = candidate.metrics.bodyScale * 2 + centerBias;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}
