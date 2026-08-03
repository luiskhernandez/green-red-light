import { MOVEMENT_THRESHOLD } from '../game/gameConfig';
import type { DebugInfo } from '../hooks/useGameEngine';
import type { GameState, Sensitivity } from '../game/gameTypes';

interface DebugOverlayProps {
  info: DebugInfo;
  state: GameState;
  sensitivity: Sensitivity;
}

/**
 * Overlay de desarrollo (?debug=true).
 * No inventamos temperatura: iPadOS no la expone al navegador.
 */
export function DebugOverlay({ info, state, sensitivity }: DebugOverlayProps) {
  const threshold = MOVEMENT_THRESHOLD[sensitivity];
  const lines = [
    `estado        ${state.phase}`,
    `corazones     ${state.hearts}  ronda ${state.roundsPlayed}  rojas ${state.redPhaseCount}`,
    `tiempo        ${(state.playElapsedMs / 1000).toFixed(1)}s / ${(state.matchDurationMs / 1000).toFixed(0)}s`,
    `camara fps    ${info.cameraFps}`,
    `inferencia    ${info.inferenceFps} fps  ${info.inferenceMs} ms`,
    `frames descart${info.droppedFrames}`,
    `movimiento    ${info.movementScore.toFixed(3)} (med ${info.smoothedScore.toFixed(3)})`,
    `umbral        ${threshold.toFixed(3)}  seguidos ${info.consecutiveOverThreshold}`,
    `confianza     ${info.poseConfidence.toFixed(2)}`,
    `match jugador ${info.matchScore.toFixed(2)}  fijado ${info.hasPlayer ? 'si' : 'no'}`,
    `poses frame   ${info.posesInFrame}`,
    info.throttled ? 'RENDIMIENTO: inferencia reducida' : '',
    'temperatura   no disponible en el navegador',
  ].filter(Boolean);

  return (
    <pre
      className={info.throttled ? 'debug debug--warn' : 'debug'}
      data-testid="debug-overlay"
      aria-hidden
    >
      {lines.join('\n')}
    </pre>
  );
}
