import {
  COUNTDOWN_FROM,
  COUNTDOWN_STEP_MS,
  GREEN_MAX_MS,
  GREEN_MIN_MS,
  HEARTS,
  MATCH_DURATION_MS,
  MOVEMENT_WARNING_MS,
  PLAYER_LOCK_MS,
  RED_GRACE_MS,
  RED_MAX_MS,
  RED_MIN_MS,
  SAFETY_REMINDER_MS,
  INFERENCE_FPS,
} from './gameConfig';
import type {
  AudioCue,
  CameraFailure,
  Effect,
  FinishReason,
  GameState,
  MatchLength,
  Phase,
} from './gameTypes';

/**
 * Maquina de estados explicita del juego (PRD seccion 8).
 *
 * Es una funcion pura: (estado, evento) -> (estado nuevo, efectos).
 * No toca el DOM, la camara ni el audio. Los efectos son datos que el
 * contenedor de React ejecuta. Eso hace que toda la logica sea testeable sin
 * camara real.
 */

export interface GameDeps {
  /** Inyectable para que las pruebas sean deterministas. */
  rng: () => number;
}

export type GameEvent =
  | { type: 'START_PRESSED'; now: number; matchLength: MatchLength }
  | { type: 'CAMERA_READY'; now: number }
  | { type: 'CAMERA_FAILED'; now: number; failure: CameraFailure }
  | { type: 'RETRY_CAMERA'; now: number }
  /** La calibracion cumplio todos los requisitos de forma continua. */
  | { type: 'CALIBRATION_OK'; now: number }
  /** El candidato se movio o desaparecio durante el bloqueo. */
  | { type: 'LOCK_ABORTED'; now: number }
  | { type: 'MOVEMENT_DETECTED'; now: number }
  | { type: 'PLAYER_LOST'; now: number }
  | { type: 'PLAYER_RECOVERED'; now: number }
  | { type: 'APP_HIDDEN'; now: number }
  | { type: 'ORIENTATION_BAD'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'ARRIVED_PRESSED'; now: number }
  | { type: 'STOP_PRESSED'; now: number }
  | { type: 'PLAY_AGAIN'; now: number; matchLength: MatchLength }
  | { type: 'GO_HOME'; now: number }
  | { type: 'TICK'; now: number };

export interface Transition {
  state: GameState;
  effects: Effect[];
}

/** Fases en las que corre el reloj de la partida. */
const PLAY_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  'GREEN',
  'RED_GRACE_PERIOD',
  'RED_DETECTION',
  'MOVEMENT_WARNING',
]);

/** Fases en las que hay una partida en curso (aunque este pausada). */
const IN_MATCH_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  ...PLAY_PHASES,
  'COUNTDOWN',
  'PLAYER_LOST',
  'PAUSED',
]);

export function isPlayPhase(phase: Phase): boolean {
  return PLAY_PHASES.has(phase);
}

export function isInMatch(phase: Phase): boolean {
  return IN_MATCH_PHASES.has(phase);
}

export function createInitialState(matchLength: MatchLength = 'SHORT'): GameState {
  return {
    phase: 'IDLE',
    hearts: HEARTS,
    phaseStartedAt: 0,
    phaseDurationMs: 0,
    countdownValue: 0,
    playElapsedMs: 0,
    matchDurationMs: MATCH_DURATION_MS[matchLength],
    lastTickAt: 0,
    redPhaseCount: 0,
    penalizedThisRed: false,
    resumePhase: null,
    finishReason: null,
    failure: null,
    banner: null,
    roundsPlayed: 0,
  };
}

function randomBetween(deps: GameDeps, min: number, max: number): number {
  return Math.round(min + deps.rng() * (max - min));
}

function say(cue: AudioCue): Effect {
  return { type: 'SAY', cue };
}

function inferenceFps(fps: number): Effect {
  return { type: 'SET_INFERENCE_FPS', fps };
}

/** Entra a una fase reiniciando su reloj. */
function enter(
  state: GameState,
  phase: Phase,
  now: number,
  durationMs: number,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    phase,
    phaseStartedAt: now,
    phaseDurationMs: durationMs,
    lastTickAt: now,
    ...patch,
  };
}

function startGreen(state: GameState, now: number, deps: GameDeps): Transition {
  return {
    state: enter(state, 'GREEN', now, randomBetween(deps, GREEN_MIN_MS, GREEN_MAX_MS), {
      banner: null,
      penalizedThisRed: false,
      resumePhase: null,
    }),
    effects: [say('greenLight'), inferenceFps(INFERENCE_FPS.green)],
  };
}

function startRed(state: GameState, now: number): Transition {
  return {
    state: enter(state, 'RED_GRACE_PERIOD', now, RED_GRACE_MS, {
      banner: null,
      penalizedThisRed: false,
      redPhaseCount: state.redPhaseCount + 1,
    }),
    effects: [say('redLight'), inferenceFps(INFERENCE_FPS.red), { type: 'RESET_MOVEMENT' }],
  };
}

function finish(state: GameState, now: number, reason: FinishReason): Transition {
  const cues: Effect[] = [];
  if (reason === 'ARRIVED') cues.push(say('arrived'), say('celebrate'));
  else if (reason === 'TIME_UP') cues.push(say('matchComplete'), say('celebrate'));
  else if (reason === 'NO_HEARTS') cues.push(say('tryAgainSlower'));

  return {
    state: enter(state, 'FINISHED', now, 0, {
      finishReason: reason,
      banner: null,
      resumePhase: null,
    }),
    effects: [
      ...cues,
      inferenceFps(INFERENCE_FPS.idle),
      { type: 'STOP_CAMERA' },
      { type: 'CLEAR_PLAYER' },
    ],
  };
}

/** Arranca una partida limpia: corazones, tiempo y contadores a cero. */
function startMatch(now: number, matchLength: MatchLength): Transition {
  return {
    state: {
      ...createInitialState(matchLength),
      phase: 'REQUESTING_CAMERA',
      phaseStartedAt: now,
      lastTickAt: now,
    },
    effects: [{ type: 'START_CAMERA' }],
  };
}

/** Acumula tiempo de juego. Solo avanza durante las fases jugables. */
function accumulate(state: GameState, now: number): GameState {
  if (!PLAY_PHASES.has(state.phase)) return { ...state, lastTickAt: now };
  const delta = Math.max(0, now - state.lastTickAt);
  return { ...state, playElapsedMs: state.playElapsedMs + delta, lastTickAt: now };
}

const noop = (state: GameState): Transition => ({ state, effects: [] });

export function reduce(state: GameState, event: GameEvent, deps: GameDeps): Transition {
  const { now } = event;

  switch (event.type) {
    case 'START_PRESSED':
      if (state.phase !== 'IDLE') return noop(state);
      return startMatch(now, event.matchLength);

    case 'PLAY_AGAIN':
      if (state.phase !== 'FINISHED') return noop(state);
      return startMatch(now, event.matchLength);

    case 'RETRY_CAMERA': {
      // Reintentar desde una pantalla de error: partida limpia, misma duracion.
      const fresh = createInitialState();
      return {
        state: enter(
          { ...fresh, matchDurationMs: state.matchDurationMs },
          'REQUESTING_CAMERA',
          now,
          0,
        ),
        effects: [{ type: 'START_CAMERA' }],
      };
    }

    case 'CAMERA_READY':
      if (state.phase !== 'REQUESTING_CAMERA') return noop(state);
      return {
        state: enter(state, 'CALIBRATING', now, 0, { failure: null }),
        effects: [inferenceFps(INFERENCE_FPS.calibration)],
      };

    case 'CAMERA_FAILED': {
      const phase: Phase =
        event.failure === 'PERMISSION_DENIED'
          ? 'PERMISSION_DENIED'
          : event.failure === 'UNSUPPORTED'
            ? 'UNSUPPORTED_DEVICE'
            : 'CAMERA_ERROR';
      return {
        state: enter(state, phase, now, 0, { failure: event.failure }),
        effects: [inferenceFps(INFERENCE_FPS.idle), { type: 'STOP_CAMERA' }],
      };
    }

    case 'CALIBRATION_OK':
      if (state.phase !== 'CALIBRATING') return noop(state);
      return {
        state: enter(state, 'LOCKING_PLAYER', now, PLAYER_LOCK_MS),
        effects: [say('playerFound'), say('stayStill')],
      };

    case 'LOCK_ABORTED':
      if (state.phase !== 'LOCKING_PLAYER') return noop(state);
      return { state: enter(state, 'CALIBRATING', now, 0), effects: [] };

    case 'MOVEMENT_DETECTED': {
      // Solo la fase de deteccion penaliza, y solo una vez por luz roja.
      if (state.phase !== 'RED_DETECTION' || state.penalizedThisRed) return noop(state);
      const hearts = Math.max(0, state.hearts - 1);
      if (hearts === 0) {
        return finish({ ...state, hearts, penalizedThisRed: true }, now, 'NO_HEARTS');
      }
      return {
        state: enter(state, 'MOVEMENT_WARNING', now, MOVEMENT_WARNING_MS, {
          hearts,
          penalizedThisRed: true,
          banner: null,
        }),
        effects: [say('sawYouMove')],
      };
    }

    case 'PLAYER_LOST': {
      if (!PLAY_PHASES.has(state.phase)) return noop(state);
      const accumulated = accumulate(state, now);
      return {
        state: enter(accumulated, 'PLAYER_LOST', now, 0, { resumePhase: state.phase }),
        effects: [say('cantSeeYou'), inferenceFps(INFERENCE_FPS.lost)],
      };
    }

    case 'PLAYER_RECOVERED':
      if (state.phase !== 'PLAYER_LOST') return noop(state);
      // Reanudamos siempre con una luz verde nueva: es lo mas justo para el
      // niño y evita continuar una luz roja a medias.
      return startGreen(state, now, deps);

    case 'APP_HIDDEN':
    case 'ORIENTATION_BAD': {
      if (!IN_MATCH_PHASES.has(state.phase) || state.phase === 'PAUSED') return noop(state);
      const accumulated = accumulate(state, now);
      return {
        state: enter(accumulated, 'PAUSED', now, 0, {
          resumePhase: state.resumePhase ?? state.phase,
        }),
        effects: [inferenceFps(INFERENCE_FPS.idle)],
      };
    }

    case 'RESUME': {
      if (state.phase !== 'PAUSED') return noop(state);
      const target = state.resumePhase;
      if (target === 'COUNTDOWN' || target === null) {
        return {
          state: enter(state, 'COUNTDOWN', now, SAFETY_REMINDER_MS, {
            countdownValue: 0,
            resumePhase: null,
          }),
          effects: [say('walkSlowly'), inferenceFps(INFERENCE_FPS.green)],
        };
      }
      if (target === 'PLAYER_LOST') {
        return {
          state: enter(state, 'PLAYER_LOST', now, 0, { resumePhase: null }),
          effects: [say('cantSeeYou'), inferenceFps(INFERENCE_FPS.lost)],
        };
      }
      return startGreen(state, now, deps);
    }

    case 'ARRIVED_PRESSED':
      if (!IN_MATCH_PHASES.has(state.phase)) return noop(state);
      return finish(accumulate(state, now), now, 'ARRIVED');

    case 'STOP_PRESSED':
      if (state.phase === 'IDLE' || state.phase === 'FINISHED') {
        return { state: enter(state, 'IDLE', now, 0, { finishReason: null }), effects: [] };
      }
      if (!IN_MATCH_PHASES.has(state.phase)) {
        // Calibrando o pidiendo camara: volvemos al inicio sin resultado.
        return {
          state: { ...createInitialState(), phase: 'IDLE', lastTickAt: now },
          effects: [
            inferenceFps(INFERENCE_FPS.idle),
            { type: 'STOP_CAMERA' },
            { type: 'CLEAR_PLAYER' },
          ],
        };
      }
      return finish(accumulate(state, now), now, 'STOPPED');

    case 'GO_HOME':
      return {
        state: { ...createInitialState(), phase: 'IDLE', lastTickAt: now },
        effects: [
          inferenceFps(INFERENCE_FPS.idle),
          { type: 'STOP_CAMERA' },
          { type: 'CLEAR_PLAYER' },
        ],
      };

    case 'TICK':
      return tick(state, now, deps);

    default: {
      const exhaustive: never = event;
      return noop(exhaustive as never);
    }
  }
}

function tick(state: GameState, now: number, deps: GameDeps): Transition {
  const elapsedInPhase = now - state.phaseStartedAt;

  // El reloj de la partida solo corre en fases jugables.
  const next = accumulate(state, now);

  if (PLAY_PHASES.has(state.phase) && next.playElapsedMs >= next.matchDurationMs) {
    return finish(next, now, 'TIME_UP');
  }

  switch (state.phase) {
    case 'LOCKING_PLAYER': {
      if (elapsedInPhase < state.phaseDurationMs) return noop(next);
      return {
        state: enter(next, 'COUNTDOWN', now, SAFETY_REMINDER_MS, { countdownValue: 0 }),
        effects: [
          { type: 'LOCK_PLAYER' },
          say('playerLocked'),
          say('walkSlowly'),
          inferenceFps(INFERENCE_FPS.green),
        ],
      };
    }

    case 'COUNTDOWN': {
      if (elapsedInPhase < state.phaseDurationMs) return noop(next);
      // countdownValue 0 = solo se dijo el recordatorio de seguridad.
      if (state.countdownValue === 0) {
        return {
          state: enter(next, 'COUNTDOWN', now, COUNTDOWN_STEP_MS, {
            countdownValue: COUNTDOWN_FROM,
          }),
          effects: [say(`count${COUNTDOWN_FROM}` as AudioCue)],
        };
      }
      if (state.countdownValue > 1) {
        const value = state.countdownValue - 1;
        return {
          state: enter(next, 'COUNTDOWN', now, COUNTDOWN_STEP_MS, { countdownValue: value }),
          effects: [say(`count${value}` as AudioCue)],
        };
      }
      // Despues del 1 arranca la partida automaticamente.
      return startGreen({ ...next, countdownValue: 0 }, now, deps);
    }

    case 'GREEN': {
      if (elapsedInPhase < state.phaseDurationMs) return noop(next);
      return startRed({ ...next, roundsPlayed: next.roundsPlayed + 1 }, now);
    }

    case 'RED_GRACE_PERIOD': {
      if (elapsedInPhase < state.phaseDurationMs) return noop(next);
      // La fase de deteccion consume lo que resta de la luz roja.
      const total = Math.round(RED_MIN_MS + deps.rng() * (RED_MAX_MS - RED_MIN_MS));
      const detectionMs = Math.max(900, total - RED_GRACE_MS);
      return {
        state: enter(next, 'RED_DETECTION', now, detectionMs),
        effects: [{ type: 'CAPTURE_REFERENCE_POSE' }],
      };
    }

    case 'RED_DETECTION': {
      if (elapsedInPhase < state.phaseDurationMs) return noop(next);
      return startGreen(next, now, deps);
    }

    case 'MOVEMENT_WARNING': {
      if (elapsedInPhase < state.phaseDurationMs) return noop(next);
      return startGreen(next, now, deps);
    }

    default:
      return noop(next);
  }
}

/** Tiempo restante de la partida en ms (>= 0). */
export function remainingMatchMs(state: GameState): number {
  return Math.max(0, state.matchDurationMs - state.playElapsedMs);
}
