/**
 * Planificador de frames.
 *
 * Requisitos del PRD (seccion 11):
 * - la inferencia corre a menor frecuencia que la camara,
 * - se procesa como maximo un frame a la vez,
 * - si llega un frame mientras el anterior sigue en proceso, se descarta,
 * - nunca se acumula una cola.
 *
 * Ademas mide el FPS real de camara y de inferencia para el overlay de debug,
 * y baja la frecuencia sola si el dispositivo no alcanza.
 */

export interface SchedulerStats {
  cameraFps: number;
  inferenceFps: number;
  droppedFrames: number;
  lastInferenceMs: number;
  throttled: boolean;
}

export type FrameHandler = (nowMs: number) => void | Promise<void>;

export class FrameScheduler {
  private rafId: number | null = null;
  private targetFps = 0;
  private busy = false;
  private lastRunAt = 0;

  private cameraFrames = 0;
  private inferenceFrames = 0;
  private windowStartedAt = 0;
  private dropped = 0;
  private slowSamples = 0;
  private throttleFactor = 1;

  private stats: SchedulerStats = {
    cameraFps: 0,
    inferenceFps: 0,
    droppedFrames: 0,
    lastInferenceMs: 0,
    throttled: false,
  };

  constructor(
    private readonly handler: FrameHandler,
    private readonly slowInferenceMs: number,
    private readonly slowSampleLimit: number,
  ) {}

  getStats(): SchedulerStats {
    return this.stats;
  }

  /** 0 detiene la inferencia pero mantiene el bucle de medicion apagado. */
  setTargetFps(fps: number): void {
    this.targetFps = fps;
    if (fps <= 0) {
      this.stop();
      return;
    }
    this.start();
  }

  /** Reporta cuanto tardo la ultima inferencia para el auto-throttle. */
  reportInference(durationMs: number): void {
    this.stats = { ...this.stats, lastInferenceMs: durationMs };
    if (durationMs > this.slowInferenceMs) {
      this.slowSamples += 1;
      if (this.slowSamples >= this.slowSampleLimit && this.throttleFactor > 0.5) {
        // Rendimiento insuficiente: bajamos a 2/3 y avisamos por stats.
        this.throttleFactor = 0.66;
        this.stats = { ...this.stats, throttled: true };
        this.slowSamples = 0;
      }
    } else {
      this.slowSamples = Math.max(0, this.slowSamples - 1);
    }
  }

  private start(): void {
    if (this.rafId !== null) return;
    this.windowStartedAt = performance.now();
    this.cameraFrames = 0;
    this.inferenceFrames = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.busy = false;
  }

  reset(): void {
    this.stop();
    this.targetFps = 0;
    this.dropped = 0;
    this.slowSamples = 0;
    this.throttleFactor = 1;
    this.stats = {
      cameraFps: 0,
      inferenceFps: 0,
      droppedFrames: 0,
      lastInferenceMs: 0,
      throttled: false,
    };
  }

  private loop = (now: number): void => {
    this.rafId = requestAnimationFrame(this.loop);
    this.cameraFrames += 1;

    // Ventana de un segundo para las metricas.
    const windowMs = now - this.windowStartedAt;
    if (windowMs >= 1000) {
      this.stats = {
        ...this.stats,
        cameraFps: Math.round((this.cameraFrames * 1000) / windowMs),
        inferenceFps: Math.round((this.inferenceFrames * 1000) / windowMs),
        droppedFrames: this.dropped,
      };
      this.cameraFrames = 0;
      this.inferenceFrames = 0;
      this.windowStartedAt = now;
    }

    if (this.targetFps <= 0) return;

    const effectiveFps = this.targetFps * this.throttleFactor;
    const minInterval = 1000 / effectiveFps;
    if (now - this.lastRunAt < minInterval) return;

    if (this.busy) {
      // Un frame ya se esta procesando: descartamos este en vez de encolarlo.
      this.dropped += 1;
      return;
    }

    this.busy = true;
    this.lastRunAt = now;
    this.inferenceFrames += 1;

    let result: void | Promise<void>;
    try {
      result = this.handler(now);
    } catch {
      this.busy = false;
      return;
    }

    if (result && typeof (result as Promise<void>).finally === 'function') {
      void (result as Promise<void>).finally(() => {
        this.busy = false;
      });
    } else {
      this.busy = false;
    }
  };
}
