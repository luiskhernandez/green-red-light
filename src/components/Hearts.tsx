import { HEARTS } from '../game/gameConfig';

/** Corazones restantes. Nunca decimos "vidas perdidas" ni nada parecido. */
export function Hearts({ hearts }: { hearts: number }) {
  return (
    <div className="hearts" aria-label={`Te quedan ${hearts} corazones`} role="img">
      {Array.from({ length: HEARTS }, (_, index) => (
        <span key={index} className={index < hearts ? 'heart' : 'heart heart--lost'} aria-hidden>
          {index < hearts ? '❤️' : '🤍'}
        </span>
      ))}
    </div>
  );
}
