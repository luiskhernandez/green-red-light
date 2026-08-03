import {
  MIN_LANDMARK_VISIBILITY,
  MOVEMENT_HISTORY_SIZE,
} from './gameConfig';
import { LM, type BodyMetrics, type Landmark, type Point, type Pose } from './gameTypes';

/**
 * Algoritmo de movimiento (PRD seccion 10).
 *
 * Idea central: comparar la pose actual contra una pose de referencia capturada
 * al empezar la luz roja, usando solo hombros, caderas y rodillas, y normalizar
 * cada desplazamiento por el tamaño del cuerpo en pantalla. Asi la sensibilidad
 * no depende de la distancia al iPad.
 */

const TORSO_INDICES = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
] as const;

/** Pesos por landmark: el torso y las piernas mandan, los hombros pesan menos. */
const WEIGHTS: Record<number, number> = {
  [LM.LEFT_SHOULDER]: 0.5,
  [LM.RIGHT_SHOULDER]: 0.5,
  [LM.LEFT_HIP]: 1,
  [LM.RIGHT_HIP]: 1,
  [LM.LEFT_KNEE]: 1,
  [LM.RIGHT_KNEE]: 1,
};

/** Peso del desplazamiento del centro del torso dentro del puntaje final. */
const TORSO_CENTER_WEIGHT = 1.5;

const TRACKED_INDICES = Object.keys(WEIGHTS).map(Number);

function isUsable(landmark: Landmark | undefined): landmark is Landmark {
  return !!landmark && landmark.visibility >= MIN_LANDMARK_VISIBILITY;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Calcula medidas del cuerpo a partir de una pose.
 * Devuelve null si el torso no es suficientemente visible: sin torso no hay
 * escala corporal y cualquier normalizacion seria basura.
 */
export function computeBodyMetrics(pose: Pose): BodyMetrics | null {
  const ls = pose[LM.LEFT_SHOULDER];
  const rs = pose[LM.RIGHT_SHOULDER];
  const lh = pose[LM.LEFT_HIP];
  const rh = pose[LM.RIGHT_HIP];

  if (!isUsable(ls) || !isUsable(rs) || !isUsable(lh) || !isUsable(rh)) return null;

  const torsoCenter: Point = {
    x: (ls.x + rs.x + lh.x + rh.x) / 4,
    y: (ls.y + rs.y + lh.y + rh.y) / 4,
  };

  const shoulderWidth = distance(ls, rs);
  const hipWidth = distance(lh, rh);
  const bodyScale = mean([distance(ls, lh), distance(rs, rh)]);

  // Sin escala corporal no podemos normalizar nada.
  if (bodyScale <= 1e-4) return null;

  const visible = pose.filter(isUsable);
  const xs = visible.map((l) => l.x);
  const ys = visible.map((l) => l.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const nose = pose[LM.NOSE];
  const ankles = [pose[LM.LEFT_ANKLE], pose[LM.RIGHT_ANKLE]].filter(isUsable);
  const bodyHeight =
    isUsable(nose) && ankles.length > 0
      ? Math.abs(mean(ankles.map((a) => a.y)) - nose.y)
      : maxY - minY;

  const confidenceIndices = [...TORSO_INDICES, LM.LEFT_KNEE, LM.RIGHT_KNEE];
  const confidence = mean(
    confidenceIndices.map((i) => pose[i]?.visibility ?? 0),
  );

  return {
    torsoCenter,
    bodyScale,
    shoulderWidth,
    hipWidth,
    bodyHeight,
    boundingBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    confidence,
  };
}

/** Pose de referencia congelada al inicio de la luz roja. */
export interface ReferencePose {
  pose: Pose;
  metrics: BodyMetrics;
}

export function createReferencePose(pose: Pose): ReferencePose | null {
  const metrics = computeBodyMetrics(pose);
  if (!metrics) return null;
  // Copia defensiva: el objeto que entrega MediaPipe se reutiliza entre frames.
  return { pose: pose.map((l) => ({ ...l })), metrics };
}

/**
 * Puntaje de movimiento normalizado respecto a la referencia.
 * 0 = inmovil. 1 = se movio el equivalente a un torso completo.
 * Devuelve null si no hay suficientes landmarks confiables para decidir.
 */
export function scoreMovement(
  reference: ReferencePose,
  current: Pose,
): { score: number; confidence: number } | null {
  const metrics = computeBodyMetrics(current);
  if (!metrics) return null;

  // Normalizamos con el promedio de ambas escalas: si el niño se acerco, la
  // escala crece y el mismo movimiento en pixeles cuenta menos.
  const scale = (reference.metrics.bodyScale + metrics.bodyScale) / 2;
  if (scale <= 1e-4) return null;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const index of TRACKED_INDICES) {
    const before = reference.pose[index];
    const after = current[index];
    if (!isUsable(before) || !isUsable(after)) continue;
    const weight = WEIGHTS[index];
    weightedSum += weight * (distance(before, after) / scale);
    weightTotal += weight;
  }

  // El desplazamiento del centro del torso captura el "avanzar caminando",
  // que es exactamente lo que queremos detectar en luz roja.
  const centerShift = distance(reference.metrics.torsoCenter, metrics.torsoCenter) / scale;
  weightedSum += TORSO_CENTER_WEIGHT * centerShift;
  weightTotal += TORSO_CENTER_WEIGHT;

  // Acercarse a la camara tambien es avanzar aunque el centro no se mueva.
  const scaleGrowth = Math.abs(metrics.bodyScale - reference.metrics.bodyScale) / scale;
  weightedSum += 1 * scaleGrowth;
  weightTotal += 1;

  // Menos de 3 landmarks utiles (ademas del centro y la escala) es muy poco.
  if (weightTotal < 3) return null;

  return { score: weightedSum / weightTotal, confidence: metrics.confidence };
}

/**
 * Acumula puntajes por frame y decide cuando penalizar.
 *
 * Reglas del PRD: nunca penalizar por un solo frame, exigir N analisis
 * consecutivos sobre el umbral, y suavizar el ruido con la mediana de un
 * historial corto.
 */
export class MovementTracker {
  private history: number[] = [];
  private consecutive = 0;
  private lastScore = 0;
  private lastSmoothed = 0;

  constructor(
    private threshold: number,
    private requiredFrames: number,
    private minConfidence: number,
  ) {}

  configure(threshold: number, requiredFrames: number): void {
    this.threshold = threshold;
    this.requiredFrames = requiredFrames;
  }

  reset(): void {
    this.history = [];
    this.consecutive = 0;
    this.lastScore = 0;
    this.lastSmoothed = 0;
  }

  get score(): number {
    return this.lastScore;
  }

  get smoothedScore(): number {
    return this.lastSmoothed;
  }

  get consecutiveOverThreshold(): number {
    return this.consecutive;
  }

  /**
   * Registra un analisis. Devuelve true cuando se cumplen todas las
   * condiciones para restar un corazon.
   */
  push(sample: { score: number; confidence: number } | null): boolean {
    if (!sample) {
      // Sin datos confiables no acusamos a nadie, pero tampoco borramos el
      // historial: un frame perdido no debe reiniciar la deteccion.
      this.consecutive = 0;
      return false;
    }

    this.lastScore = sample.score;
    this.history.push(sample.score);
    if (this.history.length > MOVEMENT_HISTORY_SIZE) this.history.shift();

    // Con un solo frame no hay nada que suavizar: esperamos al segundo.
    if (this.history.length < 2) {
      this.lastSmoothed = sample.score;
      this.consecutive = 0;
      return false;
    }

    const smoothed = median(this.history);
    this.lastSmoothed = smoothed;

    if (sample.confidence < this.minConfidence) {
      this.consecutive = 0;
      return false;
    }

    if (smoothed > this.threshold) {
      this.consecutive += 1;
    } else {
      this.consecutive = 0;
    }

    return this.consecutive >= this.requiredFrames;
  }
}
