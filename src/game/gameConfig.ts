import type { MatchLength, Sensitivity, Settings } from './gameTypes';

/**
 * Todas las constantes ajustables del juego viven aqui.
 * Ver README ("Ajustar el umbral de movimiento") para la guia de tuning.
 */

export const HEARTS = 3;

/** Cuenta regresiva: 5, 4, 3, 2, 1 (PRD estado 4). */
export const COUNTDOWN_FROM = 5;
export const COUNTDOWN_STEP_MS = 1000;

/** Aviso de seguridad antes del "5". */
export const SAFETY_REMINDER_MS = 1600;

export const GREEN_MIN_MS = 2500;
export const GREEN_MAX_MS = 5000;

export const RED_MIN_MS = 1500;
export const RED_MAX_MS = 3000;

/** Periodo de gracia al entrar en rojo: el niño alcanza a frenar. */
export const RED_GRACE_MS = 600;

/** Cuanto se muestra "Te vi moverte" antes de volver a luz verde. */
export const MOVEMENT_WARNING_MS = 1000;

/** El jugador debe estar quieto y visible este tiempo para quedar elegido. */
export const PLAYER_LOCK_MS = 2000;

/** Tolerancia antes de declarar "no puedo verte". */
export const PLAYER_LOST_GRACE_MS = 1000;

/** Tiempo que el jugador recuperado debe estar visible antes de reanudar. */
export const PLAYER_RECOVER_MS = 1200;

export const MATCH_DURATION_MS: Record<MatchLength, number> = {
  SHORT: 30_000,
  NORMAL: 60_000,
  LONG: 90_000,
};

/**
 * Umbral de movimiento normalizado (fraccion del tamaño del cuerpo).
 * Mas bajo = mas estricto. Ver movementScoring.ts para el calculo del puntaje.
 */
export const MOVEMENT_THRESHOLD: Record<Sensitivity, number> = {
  LOW: 0.16,
  NORMAL: 0.1,
  HIGH: 0.06,
};

/** Analisis consecutivos por encima del umbral requeridos para penalizar. */
export const MOVEMENT_CONSECUTIVE_FRAMES: Record<Sensitivity, number> = {
  LOW: 4,
  NORMAL: 3,
  HIGH: 3,
};

/** Tamaño del historial usado para la mediana del puntaje de movimiento. */
export const MOVEMENT_HISTORY_SIZE = 5;

/** Landmarks por debajo de esta visibilidad se ignoran. */
export const MIN_LANDMARK_VISIBILITY = 0.5;

/** Confianza media minima de la pose para considerarla utilizable. */
export const MIN_POSE_CONFIDENCE = 0.6;

/** Confianza minima para permitir una penalizacion. */
export const MIN_PENALTY_CONFIDENCE = 0.65;

/**
 * Similitud minima (0..1) entre una pose candidata y la firma del jugador
 * seleccionado para considerarla "el mismo jugador".
 */
export const PLAYER_MATCH_THRESHOLD = 0.55;

/** Zona central valida durante calibracion, en fracciones del ancho/alto. */
export const CALIBRATION_ZONE = { minX: 0.2, maxX: 0.8, minY: 0.05, maxY: 0.98 };

/** Frecuencias de inferencia (FPS) por fase. Termica > precision. */
export const INFERENCE_FPS = {
  calibration: 12,
  green: 4,
  red: 11,
  lost: 8,
  idle: 0,
} as const;

/** Resolucion y captura de camara. */
export const CAMERA_CONSTRAINTS = {
  width: 640,
  height: 480,
  frameRate: 30,
} as const;

/** Si la inferencia tarda mas que esto de forma sostenida, bajamos FPS. */
export const SLOW_INFERENCE_MS = 120;
export const SLOW_INFERENCE_SAMPLES = 20;

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 'NORMAL',
  matchLength: 'SHORT',
  volume: 'HIGH',
  preview: 'HIDDEN',
};

export const SETTINGS_STORAGE_KEY = 'lvlr.settings.v1';

export const MODEL_URL = 'models/pose_landmarker_lite.task';
export const WASM_BASE_PATH = 'mediapipe/wasm';
