import { CAMERA_CONSTRAINTS } from '../game/gameConfig';
import type { CameraFacing, CameraFailure } from '../game/gameTypes';

/**
 * Envoltura minima sobre getUserMedia. Solo hace tres cosas: pedir la camara
 * a baja resolucion, conectarla a un <video>, y apagarla.
 *
 * El video nunca sale del dispositivo: no hay grabacion, ni canvas exportado,
 * ni peticiones de red con imagenes.
 */

export class CameraError extends Error {
  constructor(public readonly failure: CameraFailure, message: string) {
    super(message);
    this.name = 'CameraError';
  }
}

export interface CameraStartResult {
  width: number;
  height: number;
}

export class CameraController {
  private stream: MediaStream | null = null;

  get active(): boolean {
    return this.stream !== null;
  }

  async start(video: HTMLVideoElement, facing: CameraFacing = 'BACK'): Promise<CameraStartResult> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('UNSUPPORTED', 'Este navegador no permite usar la camara.');
    }

    this.stop();

    try {
      // 'environment' = trasera, 'user' = frontal. Usamos `ideal` y no `exact`
      // a proposito: si el dispositivo no tiene la camara pedida (un portatil
      // no tiene trasera), Safari entrega la que haya y el juego sigue
      // funcionando en vez de fallar con OverconstrainedError.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing === 'FRONT' ? 'user' : 'environment' },
          width: { ideal: CAMERA_CONSTRAINTS.width },
          height: { ideal: CAMERA_CONSTRAINTS.height },
          frameRate: { ideal: CAMERA_CONSTRAINTS.frameRate, max: CAMERA_CONSTRAINTS.frameRate },
        },
      });
    } catch (error) {
      throw new CameraError(classifyError(error), describeError(error));
    }

    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;

    await waitForMetadata(video);
    await video.play().catch(() => {
      // Safari puede rechazar play() si el gesto expiro; el usuario reintenta.
    });

    return { width: video.videoWidth, height: video.videoHeight };
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new CameraError('NO_CAMERA', 'La camara no envio imagen.')),
      10_000,
    );
    const done = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', done);
      resolve();
    };
    video.addEventListener('loadedmetadata', done, { once: true });
  });
}

function classifyError(error: unknown): CameraFailure {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'PERMISSION_DENIED';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'NO_CAMERA';
  if (name === 'NotReadableError') return 'NO_CAMERA';
  return 'NO_CAMERA';
}

function describeError(error: unknown): string {
  const failure = classifyError(error);
  if (failure === 'PERMISSION_DENIED') return 'No nos dieron permiso para usar la camara.';
  return 'No encontramos una camara disponible.';
}
