import type { CalibrationCheck } from '../game/calibration';
import { StopButton } from './StopButton';

interface CalibrationScreenProps {
  calibration: CalibrationCheck;
  /** true cuando ya estamos fijando al jugador (fase LOCKING_PLAYER). */
  locking: boolean;
  modelLoading: boolean;
  /** true si estamos usando la camara frontal. */
  frontCamera: boolean;
  onStop: () => void;
  onFlipCamera: () => void;
}

/**
 * La camara se ve de fondo (la monta App en CameraStage). Esta pantalla solo
 * pinta las instrucciones encima, en una sola columna centrada.
 */
export function CalibrationScreen({
  calibration,
  locking,
  modelLoading,
  frontCamera,
  onStop,
  onFlipCamera,
}: CalibrationScreenProps) {
  return (
    <div className="screen screen--over-camera" data-testid="screen-calibration">
      <p className="badge">{locking ? 'Jugador encontrado' : 'Preparemos el espacio'}</p>

      <h2 className="headline" data-testid="calibration-message">
        {modelLoading
          ? 'Cargando el detector...'
          : locking
            ? 'Quedate quieto como una estatua'
            : calibration.message}
      </h2>

      {!locking && (
        <p className="note">
          Coloca el iPad en un lugar estable y asegurate de que veamos tu cuerpo completo. Deja
          espacio para caminar y detenerte.
        </p>
      )}

      {calibration.missingParts.length > 0 && !locking && (
        <p className="note">No vemos bien: {calibration.missingParts.join(', ')}.</p>
      )}

      <p className="lead">Camina despacio. No corras.</p>

      <div className="hud hud--bottom">
        <StopButton onStop={onStop} />
        {/*
          Cambiar de camara aqui y no solo en Ajustes: si estas montando el iPad
          tu solo, no tiene sentido volver al inicio para descubrir que la
          camara apunta al lado contrario.
        */}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onFlipCamera}
          data-testid="flip-camera-button"
        >
          🔄 {frontCamera ? 'Usar cámara trasera' : 'Usar cámara frontal'}
        </button>
      </div>
    </div>
  );
}
