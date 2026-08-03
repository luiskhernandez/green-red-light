import { useEffect, useRef } from 'react';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { MIN_LANDMARK_VISIBILITY } from '../game/gameConfig';
import type { BoundingBox, Pose } from '../game/gameTypes';

/**
 * hidden     - presente en el DOM pero invisible (durante la partida).
 * background - a pantalla completa, con la interfaz encima (calibracion).
 * thumb      - miniatura en una esquina.
 * large      - recuadro grande en una esquina ("Visible" en los ajustes).
 */
export type CameraMode = 'hidden' | 'background' | 'thumb' | 'large';

interface CameraStageProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mode: CameraMode;
  /** Zona guia para colocarse. Solo en calibracion y al recuperar al jugador. */
  showZone?: boolean;
  zoneReady?: boolean;
  playerBox?: BoundingBox | null;
  playerLocked?: boolean;
  /** Landmarks: solo en calibracion o en modo desarrollador. */
  landmarks?: Pose | null;
}

/**
 * El unico lugar del arbol donde vive el <video>.
 *
 * Se monta una sola vez y nunca cambia de padre: si se remontara, Safari
 * perderia el srcObject y habria que volver a pedir la camara. Todo el cambio
 * de tamaño (pantalla completa / miniatura / oculto) se hace con CSS.
 */
export function CameraStage({
  videoRef,
  mode,
  showZone = false,
  zoneReady = false,
  playerBox = null,
  playerLocked = false,
  landmarks = null,
}: CameraStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visible = mode !== 'hidden';
  const drawLandmarks = visible && landmarks !== null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);

    if (!drawLandmarks || !landmarks) return;

    ctx.lineWidth = Math.max(2, width / 220);
    ctx.strokeStyle = 'rgba(255, 201, 60, 0.9)';
    for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
      const from = landmarks[connection.start];
      const to = landmarks[connection.end];
      if (!from || !to) continue;
      if (from.visibility < MIN_LANDMARK_VISIBILITY || to.visibility < MIN_LANDMARK_VISIBILITY) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(from.x * width, from.y * height);
      ctx.lineTo(to.x * width, to.y * height);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(61, 220, 151, 0.95)';
    const radius = Math.max(2, width / 260);
    for (const point of landmarks) {
      if (point.visibility < MIN_LANDMARK_VISIBILITY) continue;
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks, drawLandmarks, mode]);

  return (
    <div className={`camera-stage camera-stage--${mode}`} data-testid="camera-stage">
      <video ref={videoRef} playsInline muted autoPlay data-testid="camera-video" />
      <canvas ref={canvasRef} />
      {visible && showZone && (
        <div className={zoneReady ? 'camera-zone camera-zone--ready' : 'camera-zone'} />
      )}
      {visible && playerBox && (
        <div
          className={playerLocked ? 'player-frame player-frame--locked' : 'player-frame'}
          style={{
            left: `${playerBox.x * 100}%`,
            top: `${playerBox.y * 100}%`,
            width: `${playerBox.width * 100}%`,
            height: `${playerBox.height * 100}%`,
          }}
          data-testid="player-frame"
        />
      )}
    </div>
  );
}
