import { StopButton } from './StopButton';

interface PlayerLostScreenProps {
  /** true si ya vemos una pose compatible con el jugador seleccionado. */
  playerVisible: boolean;
  onStop: () => void;
  onArrived: () => void;
}

/**
 * El jugador desaparecio mas de un segundo. La camara vuelve a verse de fondo
 * y esperamos a que reaparezca. Nunca adoptamos a otra persona.
 */
export function PlayerLostScreen({ playerVisible, onStop, onArrived }: PlayerLostScreenProps) {
  return (
    <div className="screen screen--over-camera" data-testid="screen-lost">
      <h2 className="headline">No puedo verte</h2>
      <p className="lead">
        {playerVisible
          ? '¡Ahi estas! Quedate quieto un momento...'
          : 'Vuelve a la zona de juego, frente al iPad.'}
      </p>
      <p className="note">La partida sigue donde la dejaste. No perdiste corazones.</p>

      <div className="hud hud--bottom">
        <StopButton onStop={onStop} />
        <button type="button" className="btn btn--go" onClick={onArrived}>
          🏁 Llegó
        </button>
      </div>
    </div>
  );
}
