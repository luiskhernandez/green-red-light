import { HEARTS } from '../game/gameConfig';
import type { FinishReason } from '../game/gameTypes';
import { Hearts } from './Hearts';
import { Mascot } from './Mascot';

interface ResultScreenProps {
  reason: FinishReason;
  hearts: number;
  playedSeconds: number;
  onPlayAgain: () => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
}

/**
 * Nunca hay pantalla de derrota. Cuando se acaban los corazones el mensaje
 * invita a intentarlo otra vez caminando mas despacio.
 */
const COPY: Record<FinishReason, { title: string; note: string; mood: 'happy' | 'sleepy' }> = {
  ARRIVED: {
    title: '¡Llegaste!',
    note: 'Muy bien. Caminaste despacio hasta la meta.',
    mood: 'happy',
  },
  TIME_UP: {
    title: '¡Partida completada!',
    note: 'Terminaste el tiempo del juego. ¡Bien hecho!',
    mood: 'happy',
  },
  NO_HEARTS: {
    title: 'Probemos otra vez caminando mas despacio',
    note: 'Cada vez te sale mejor quedarte como estatua.',
    mood: 'sleepy',
  },
  STOPPED: {
    title: 'Juego detenido',
    note: 'Cuando quieran seguir, toquen "Jugar otra vez".',
    mood: 'sleepy',
  },
};

export function ResultScreen({
  reason,
  hearts,
  playedSeconds,
  onPlayAgain,
  onOpenSettings,
  onGoHome,
}: ResultScreenProps) {
  const copy = COPY[reason];

  return (
    <div className="screen screen--result" data-testid="screen-result" data-reason={reason}>
      <Mascot mood={copy.mood} />
      <h2 className="headline" data-testid="result-title">
        {copy.title}
      </h2>
      <p className="lead">{copy.note}</p>
      <Hearts hearts={hearts} />
      <p className="note">
        Corazones: {hearts} de {HEARTS} · Tiempo jugado: {playedSeconds}s
      </p>

      <div className="btn-row">
        <button
          type="button"
          className="btn btn--huge btn--primary"
          onClick={onPlayAgain}
          data-testid="play-again-button"
        >
          🔁 Jugar otra vez
        </button>
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onOpenSettings}>
          🎚 Cambiar sensibilidad
        </button>
        <button type="button" className="btn" onClick={onGoHome} data-testid="home-button">
          🏠 Volver al inicio
        </button>
      </div>
    </div>
  );
}
