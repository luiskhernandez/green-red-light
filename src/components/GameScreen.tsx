import { remainingMatchMs } from '../game/gameMachine';
import type { GameState } from '../game/gameTypes';
import { Hearts } from './Hearts';
import { Mascot } from './Mascot';
import { StopButton } from './StopButton';

interface GameScreenProps {
  state: GameState;
  onArrived: () => void;
  onStop: () => void;
}

export function GameScreen({ state, onArrived, onStop }: GameScreenProps) {
  const isGreen = state.phase === 'GREEN';
  const isWarning = state.phase === 'MOVEMENT_WARNING';

  const screenClass = isWarning
    ? 'screen screen--warning'
    : isGreen
      ? 'screen screen--green'
      : 'screen screen--red';

  const secondsLeft = Math.ceil(remainingMatchMs(state) / 1000);

  return (
    <div className={screenClass} data-testid="screen-game" data-phase={state.phase}>
      <div className="hud hud--top">
        <Hearts hearts={state.hearts} />
        <span className="time-pill" data-testid="time-left">
          ⏱ {secondsLeft}s
        </span>
      </div>

      {isWarning ? (
        <>
          <Mascot mood="red" />
          <h2 className="headline" data-testid="warning-message">
            ¡Te vi moverte!
          </h2>
          <p className="lead">Quedate como estatua. Intentalo otra vez.</p>
        </>
      ) : (
        <>
          <Mascot mood={isGreen ? 'green' : 'red'} />
          {/* La duracion de cada luz nunca se muestra: no saberla es parte del juego. */}
          <p className="light-word" data-testid="light-word">
            {isGreen ? 'Luz verde' : 'Luz roja'}
          </p>
          <p className="lead">
            {isGreen
              ? 'Camina despacio hacia el iPad.'
              : state.phase === 'RED_GRACE_PERIOD'
                ? 'Termina de detenerte...'
                : '🧊 Congelate. No te muevas.'}
          </p>
        </>
      )}

      <div className="hud hud--bottom">
        <StopButton onStop={onStop} />
        <button
          type="button"
          className="btn btn--huge btn--go"
          onClick={onArrived}
          data-testid="arrived-button"
        >
          🏁 Llegó
        </button>
      </div>
    </div>
  );
}
