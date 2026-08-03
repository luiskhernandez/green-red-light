import type { CalibrationCheck } from '../game/calibration';
import { StopButton } from './StopButton';

interface CalibrationScreenProps {
  calibration: CalibrationCheck;
  /** true cuando ya estamos fijando al jugador (fase LOCKING_PLAYER). */
  locking: boolean;
  modelLoading: boolean;
  onStop: () => void;
}

/**
 * La camara se ve de fondo (la monta App en CameraStage). Esta pantalla solo
 * pinta las instrucciones encima, en una sola columna centrada.
 */
export function CalibrationScreen({
  calibration,
  locking,
  modelLoading,
  onStop,
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
      </div>
    </div>
  );
}
