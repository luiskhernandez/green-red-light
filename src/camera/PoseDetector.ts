import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MODEL_URL, WASM_BASE_PATH } from '../game/gameConfig';
import type { Pose } from '../game/gameTypes';

/**
 * Detector de pose local (MediaPipe Pose Landmarker, modelo "lite").
 *
 * Configuracion deliberadamente austera para no calentar el iPad:
 * - numPoses: 2. Solo necesitamos una para la logica, pero ver una segunda
 *   persona nos permite avisar "solo debe haber un jugador" en calibracion.
 * - Sin mascaras de segmentacion, sin manos, sin rostro.
 * - runningMode 'VIDEO' para que el modelo aproveche el tracking entre frames.
 *
 * El modelo y el runtime wasm se sirven desde el propio origen (public/), no
 * desde un CDN, para que el service worker los pueda cachear y el juego
 * funcione sin conexion despues de la primera partida.
 */

export interface PoseFrame {
  poses: Pose[];
  /** Cuanto tardo la inferencia, para el overlay de desarrollo. */
  inferenceMs: number;
  timestampMs: number;
}

export class ModelLoadError extends Error {
  constructor(cause: unknown) {
    super('No pudimos cargar el modelo de deteccion.');
    this.name = 'ModelLoadError';
    this.cause = cause;
  }
}

function assetUrl(path: string): string {
  // import.meta.env.BASE_URL respeta el subdirectorio de GitHub Pages.
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).toString();
}

export class PoseDetector {
  private landmarker: PoseLandmarker | null = null;
  private loading: Promise<void> | null = null;
  /** MediaPipe exige timestamps estrictamente crecientes en modo VIDEO. */
  private lastTimestamp = -1;

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /** Carga (una sola vez) el runtime wasm y el modelo. Idempotente. */
  load(): Promise<void> {
    if (this.landmarker) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(assetUrl(WASM_BASE_PATH));
        this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: assetUrl(MODEL_URL),
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputSegmentationMasks: false,
        });
      } catch (error) {
        this.loading = null;
        throw new ModelLoadError(error);
      }
    })();

    return this.loading;
  }

  /**
   * Analiza un frame de video. Devuelve null si el detector no esta listo o si
   * el timestamp no avanzo (MediaPipe rechaza timestamps repetidos).
   */
  detect(video: HTMLVideoElement, timestampMs: number): PoseFrame | null {
    if (!this.landmarker) return null;
    const stamp = timestampMs <= this.lastTimestamp ? this.lastTimestamp + 1 : timestampMs;
    this.lastTimestamp = stamp;

    const startedAt = performance.now();
    const result = this.landmarker.detectForVideo(video, stamp);
    const inferenceMs = performance.now() - startedAt;

    return {
      poses: result.landmarks as Pose[],
      inferenceMs,
      timestampMs: stamp,
    };
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.loading = null;
    this.lastTimestamp = -1;
  }
}
