/**
 * Tipos compartidos por la logica de juego.
 *
 * Nada en este archivo depende del DOM, de la camara ni de MediaPipe, para que
 * la maquina de estados y el algoritmo de movimiento puedan probarse sin
 * hardware real (ver src/game/*.test.ts).
 */

/** Un landmark normalizado (0..1 respecto al frame) con confianza. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** Una pose = 33 landmarks del modelo de MediaPipe Pose Landmarker. */
export type Pose = Landmark[];

/** Indices de los landmarks que usamos. El resto se ignora deliberadamente. */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Medidas derivadas de una pose. Se calculan una vez por frame y se reusan
 * para seguimiento de identidad, calibracion y puntaje de movimiento.
 */
export interface BodyMetrics {
  /** Promedio de hombros y caderas. */
  torsoCenter: Point;
  /** Distancia promedio hombro-cadera. Escala del cuerpo en pantalla. */
  bodyScale: number;
  shoulderWidth: number;
  hipWidth: number;
  /** Distancia vertical nariz -> tobillos (aprox. altura visible). */
  bodyHeight: number;
  boundingBox: BoundingBox;
  /** Confianza media de los landmarks del torso y piernas. */
  confidence: number;
}

/** Firma visual del jugador seleccionado. Sin datos biometricos ni rostro. */
export interface PlayerSignature {
  shoulderWidth: number;
  hipWidth: number;
  bodyScale: number;
  bodyHeight: number;
  boundingBoxArea: number;
  center: Point;
}

/** Estados explicitos de la maquina de estados (PRD seccion 8). */
export type Phase =
  | 'IDLE'
  | 'REQUESTING_CAMERA'
  | 'CALIBRATING'
  | 'LOCKING_PLAYER'
  | 'COUNTDOWN'
  | 'GREEN'
  | 'RED_GRACE_PERIOD'
  | 'RED_DETECTION'
  | 'MOVEMENT_WARNING'
  | 'PLAYER_LOST'
  | 'PAUSED'
  | 'FINISHED'
  | 'CAMERA_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_DEVICE';

export type FinishReason = 'ARRIVED' | 'TIME_UP' | 'NO_HEARTS' | 'STOPPED';

export type CameraFailure =
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'MODEL_FAILED'
  | 'UNSUPPORTED';

/** Motivo por el que la calibracion aun no puede continuar. */
export type CalibrationIssue =
  | 'NO_PLAYER'
  | 'MULTIPLE_PEOPLE'
  | 'PARTIAL_BODY'
  | 'OUT_OF_ZONE'
  | 'LOW_CONFIDENCE'
  | 'READY';

export type Sensitivity = 'LOW' | 'NORMAL' | 'HIGH';
export type MatchLength = 'SHORT' | 'NORMAL' | 'LONG';
export type Volume = 'MUTE' | 'LOW' | 'HIGH';
export type PreviewMode = 'HIDDEN' | 'THUMBNAIL' | 'VISIBLE';

export interface Settings {
  sensitivity: Sensitivity;
  matchLength: MatchLength;
  volume: Volume;
  preview: PreviewMode;
}

/**
 * Efectos que la maquina pide al mundo exterior. La maquina no reproduce
 * audio ni toca la camara: solo describe lo que debe pasar.
 */
export type Effect =
  | { type: 'SAY'; cue: AudioCue }
  | { type: 'CAPTURE_REFERENCE_POSE' }
  | { type: 'RESET_MOVEMENT' }
  | { type: 'LOCK_PLAYER' }
  | { type: 'CLEAR_PLAYER' }
  | { type: 'SET_INFERENCE_FPS'; fps: number }
  | { type: 'STOP_CAMERA' }
  | { type: 'START_CAMERA' };

export type AudioCue =
  | 'playerFound'
  | 'stayStill'
  | 'playerLocked'
  | 'walkSlowly'
  | 'count5'
  | 'count4'
  | 'count3'
  | 'count2'
  | 'count1'
  | 'greenLight'
  | 'redLight'
  | 'sawYouMove'
  | 'cantSeeYou'
  | 'arrived'
  | 'celebrate'
  | 'matchComplete'
  | 'tryAgainSlower';

/** Estado completo de la partida. */
export interface GameState {
  phase: Phase;
  hearts: number;
  /** Marca de tiempo (ms) en la que entramos a la fase actual. */
  phaseStartedAt: number;
  /** Duracion prevista de la fase actual. 0 = la fase no expira por tiempo. */
  phaseDurationMs: number;
  countdownValue: number;
  /** Tiempo de juego acumulado (excluye pausas y cuenta regresiva). */
  playElapsedMs: number;
  matchDurationMs: number;
  /** Ultimo instante en que se acumulo tiempo de juego. */
  lastTickAt: number;
  /** Cuantas luces rojas han ocurrido en la partida. */
  redPhaseCount: number;
  /** Ya se descontó un corazon en esta luz roja. */
  penalizedThisRed: boolean;
  /** Fase a la que volvemos al reanudar desde PLAYER_LOST / PAUSED. */
  resumePhase: Phase | null;
  finishReason: FinishReason | null;
  failure: CameraFailure | null;
  /** Mensaje grande visible en pantalla. */
  banner: string | null;
  /** Numero de luz verde/roja completadas, solo informativo. */
  roundsPlayed: number;
}
