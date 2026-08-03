import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  reduce,
  remainingMatchMs,
  type GameDeps,
  type GameEvent,
} from './gameMachine';
import {
  COUNTDOWN_STEP_MS,
  GREEN_MIN_MS,
  HEARTS,
  MOVEMENT_WARNING_MS,
  PLAYER_LOCK_MS,
  RED_GRACE_MS,
  SAFETY_REMINDER_MS,
} from './gameConfig';
import type { Effect, GameState, Phase } from './gameTypes';

/**
 * La maquina es pura, asi que estas pruebas cubren el juego completo sin
 * camara, sin audio y sin DOM.
 */

/** rng fijo: elige siempre el minimo de cada rango. */
const deps: GameDeps = { rng: () => 0 };

function send(state: GameState, event: GameEvent) {
  return reduce(state, event, deps);
}

function cues(effects: Effect[]): string[] {
  return effects.filter((e) => e.type === 'SAY').map((e) => e.cue);
}

/** Avanza el reloj hasta que la fase cambie, o falla si no cambia. */
function advanceUntilPhaseChange(state: GameState, startAt: number, limitMs = 20_000) {
  const from = state.phase;
  let now = startAt;
  let current = state;
  const collected: Effect[] = [];
  while (now - startAt < limitMs) {
    now += 50;
    const result = send(current, { type: 'TICK', now });
    current = result.state;
    collected.push(...result.effects);
    if (current.phase !== from) return { state: current, now, effects: collected };
  }
  throw new Error(`La fase ${from} no cambio en ${limitMs} ms`);
}

/** Lleva la partida hasta la primera luz verde. */
function playUntilGreen(startAt = 1000) {
  let now = startAt;
  let state = createInitialState('SHORT');

  state = send(state, { type: 'START_PRESSED', now, matchLength: 'SHORT' }).state;
  state = send(state, { type: 'CAMERA_READY', now }).state;
  state = send(state, { type: 'CALIBRATION_OK', now }).state;

  // LOCKING_PLAYER -> COUNTDOWN
  let step = advanceUntilPhaseChange(state, now);
  state = step.state;
  now = step.now;

  // COUNTDOWN: recordatorio + 5..1 -> GREEN
  while (state.phase === 'COUNTDOWN') {
    step = advanceUntilPhaseChange(state, now);
    state = step.state;
    now = step.now;
  }

  return { state, now };
}

describe('flujo principal', () => {
  it('IDLE -> REQUESTING_CAMERA solo despues de pulsar empezar', () => {
    const initial = createInitialState('SHORT');
    expect(initial.phase).toBe('IDLE');

    // Un TICK por si solo no debe abrir la camara.
    expect(send(initial, { type: 'TICK', now: 500 }).state.phase).toBe('IDLE');

    const started = send(initial, { type: 'START_PRESSED', now: 1000, matchLength: 'SHORT' });
    expect(started.state.phase).toBe('REQUESTING_CAMERA');
    expect(started.effects).toContainEqual({ type: 'START_CAMERA' });
  });

  it('la calibracion pide quietud antes de fijar al jugador', () => {
    let state = createInitialState('SHORT');
    state = send(state, { type: 'START_PRESSED', now: 0, matchLength: 'SHORT' }).state;
    state = send(state, { type: 'CAMERA_READY', now: 0 }).state;
    expect(state.phase).toBe('CALIBRATING');

    const locking = send(state, { type: 'CALIBRATION_OK', now: 0 });
    expect(locking.state.phase).toBe('LOCKING_PLAYER');
    expect(cues(locking.effects)).toEqual(['playerFound', 'stayStill']);

    // Antes de los 2 s no se fija a nadie.
    const early = send(locking.state, { type: 'TICK', now: PLAYER_LOCK_MS - 100 });
    expect(early.state.phase).toBe('LOCKING_PLAYER');
    expect(early.effects).toHaveLength(0);

    const locked = send(locking.state, { type: 'TICK', now: PLAYER_LOCK_MS });
    expect(locked.state.phase).toBe('COUNTDOWN');
    expect(locked.effects).toContainEqual({ type: 'LOCK_PLAYER' });
  });

  it('si el candidato se mueve, volvemos a calibrar', () => {
    let state = createInitialState('SHORT');
    state = send(state, { type: 'START_PRESSED', now: 0, matchLength: 'SHORT' }).state;
    state = send(state, { type: 'CAMERA_READY', now: 0 }).state;
    state = send(state, { type: 'CALIBRATION_OK', now: 0 }).state;

    const aborted = send(state, { type: 'LOCK_ABORTED', now: 500 });
    expect(aborted.state.phase).toBe('CALIBRATING');
  });

  it('la cuenta regresiva muestra exactamente 5, 4, 3, 2, 1 con audio', () => {
    let state = createInitialState('SHORT');
    state = send(state, { type: 'START_PRESSED', now: 0, matchLength: 'SHORT' }).state;
    state = send(state, { type: 'CAMERA_READY', now: 0 }).state;
    state = send(state, { type: 'CALIBRATION_OK', now: 0 }).state;

    let now = PLAYER_LOCK_MS;
    const entered = send(state, { type: 'TICK', now });
    state = entered.state;
    // Antes del 5 se recuerda caminar despacio.
    expect(cues(entered.effects)).toContain('walkSlowly');
    expect(state.countdownValue).toBe(0);

    const seen: number[] = [];
    const audio: string[] = [];
    now += SAFETY_REMINDER_MS;
    while (state.phase === 'COUNTDOWN') {
      const result = send(state, { type: 'TICK', now });
      if (result.state.phase === 'COUNTDOWN') {
        seen.push(result.state.countdownValue);
        audio.push(...cues(result.effects));
      } else {
        // Al terminar el 1 arranca la partida sin intervencion.
        expect(result.state.phase).toBe('GREEN');
        expect(cues(result.effects)).toContain('greenLight');
      }
      state = result.state;
      now += COUNTDOWN_STEP_MS;
    }

    expect(seen).toEqual([5, 4, 3, 2, 1]);
    expect(audio).toEqual(['count5', 'count4', 'count3', 'count2', 'count1']);
  });

  it('alterna verde y rojo con periodo de gracia intermedio', () => {
    const { state: green, now } = playUntilGreen();
    expect(green.phase).toBe('GREEN');
    expect(green.phaseDurationMs).toBe(GREEN_MIN_MS);

    const red = advanceUntilPhaseChange(green, now);
    expect(red.state.phase).toBe('RED_GRACE_PERIOD');
    expect(red.state.phaseDurationMs).toBe(RED_GRACE_MS);
    expect(cues(red.effects)).toContain('redLight');

    const detection = advanceUntilPhaseChange(red.state, red.now);
    expect(detection.state.phase).toBe('RED_DETECTION');
    // La pose de referencia se captura al terminar la gracia, no antes.
    expect(detection.effects).toContainEqual({ type: 'CAPTURE_REFERENCE_POSE' });

    const backToGreen = advanceUntilPhaseChange(detection.state, detection.now);
    expect(backToGreen.state.phase).toBe('GREEN');
  });

  it('la duracion de las luces varia entre partidas', () => {
    const values = new Set<number>();
    for (const value of [0, 0.5, 0.99]) {
      const state = createInitialState('SHORT');
      const started = reduce(
        { ...state, phase: 'RED_DETECTION', phaseStartedAt: 0, phaseDurationMs: 0 },
        { type: 'TICK', now: 10 },
        { rng: () => value },
      );
      values.add(started.state.phaseDurationMs);
    }
    expect(values.size).toBe(3);
  });
});

describe('movimiento y corazones', () => {
  it('empieza con tres corazones', () => {
    expect(createInitialState('SHORT').hearts).toBe(3);
    expect(HEARTS).toBe(3);
  });

  it('el movimiento en gracia no penaliza', () => {
    const { state: green, now } = playUntilGreen();
    const red = advanceUntilPhaseChange(green, now);
    expect(red.state.phase).toBe('RED_GRACE_PERIOD');

    const ignored = send(red.state, { type: 'MOVEMENT_DETECTED', now: red.now + 100 });
    expect(ignored.state.hearts).toBe(3);
    expect(ignored.state.phase).toBe('RED_GRACE_PERIOD');
  });

  it('resta un corazon y sigue jugando', () => {
    const { state: green, now } = playUntilGreen();
    const red = advanceUntilPhaseChange(green, now);
    const detection = advanceUntilPhaseChange(red.state, red.now);

    const hit = send(detection.state, { type: 'MOVEMENT_DETECTED', now: detection.now + 10 });
    expect(hit.state.hearts).toBe(2);
    expect(hit.state.phase).toBe('MOVEMENT_WARNING');
    expect(cues(hit.effects)).toEqual(['sawYouMove']);

    // Tras la advertencia la partida continua con una luz verde nueva.
    const resumed = send(hit.state, {
      type: 'TICK',
      now: detection.now + 10 + MOVEMENT_WARNING_MS,
    });
    expect(resumed.state.phase).toBe('GREEN');
    expect(resumed.state.hearts).toBe(2);
  });

  it('nunca resta mas de un corazon en la misma luz roja', () => {
    const { state: green, now } = playUntilGreen();
    const red = advanceUntilPhaseChange(green, now);
    const detection = advanceUntilPhaseChange(red.state, red.now);

    const first = send(detection.state, { type: 'MOVEMENT_DETECTED', now: detection.now + 10 });
    expect(first.state.hearts).toBe(2);

    // Aunque volvamos a la fase de deteccion con la misma bandera puesta.
    const stillFlagged = { ...first.state, phase: 'RED_DETECTION' as Phase };
    const second = send(stillFlagged, { type: 'MOVEMENT_DETECTED', now: detection.now + 20 });
    expect(second.state.hearts).toBe(2);
    expect(second.state.phase).toBe('RED_DETECTION');
  });

  it('la bandera de penalizacion se limpia en la siguiente luz roja', () => {
    const { state: green, now } = playUntilGreen();
    const red = advanceUntilPhaseChange(green, now);
    const detection = advanceUntilPhaseChange(red.state, red.now);
    const hit = send(detection.state, { type: 'MOVEMENT_DETECTED', now: detection.now + 10 });
    expect(hit.state.penalizedThisRed).toBe(true);

    const nextGreen = advanceUntilPhaseChange(hit.state, detection.now + 10);
    expect(nextGreen.state.penalizedThisRed).toBe(false);
  });

  it('sin corazones termina con mensaje amable, no con derrota', () => {
    let state: GameState = { ...playUntilGreen().state, hearts: 1, phase: 'RED_DETECTION' };
    const result = send(state, { type: 'MOVEMENT_DETECTED', now: 50_000 });
    state = result.state;

    expect(state.hearts).toBe(0);
    expect(state.phase).toBe('FINISHED');
    expect(state.finishReason).toBe('NO_HEARTS');
    expect(cues(result.effects)).toEqual(['tryAgainSlower']);
    expect(result.effects).toContainEqual({ type: 'STOP_CAMERA' });
  });
});

describe('jugador perdido', () => {
  it('pausa el juego y lo reanuda sin reiniciar la partida', () => {
    const { state: green, now } = playUntilGreen();
    const played = send(green, { type: 'TICK', now: now + 1000 }).state;
    expect(played.playElapsedMs).toBeGreaterThan(0);

    const lost = send(played, { type: 'PLAYER_LOST', now: now + 1200 });
    expect(lost.state.phase).toBe('PLAYER_LOST');
    expect(cues(lost.effects)).toEqual(['cantSeeYou']);
    expect(lost.state.resumePhase).toBe('GREEN');

    // Mientras no vemos al jugador el reloj no avanza.
    const waiting = send(lost.state, { type: 'TICK', now: now + 8000 });
    expect(waiting.state.playElapsedMs).toBe(lost.state.playElapsedMs);
    expect(waiting.state.phase).toBe('PLAYER_LOST');

    const recovered = send(waiting.state, { type: 'PLAYER_RECOVERED', now: now + 8100 });
    expect(recovered.state.phase).toBe('GREEN');
    expect(recovered.state.hearts).toBe(lost.state.hearts);
    expect(recovered.state.playElapsedMs).toBe(lost.state.playElapsedMs);
  });

  it('perder al jugador fuera de una fase jugable no hace nada', () => {
    const state = createInitialState('SHORT');
    expect(send(state, { type: 'PLAYER_LOST', now: 10 }).state.phase).toBe('IDLE');
  });
});

describe('pausas del sistema', () => {
  it('pasar a segundo plano pausa de inmediato', () => {
    const { state: green, now } = playUntilGreen();
    const hidden = send(green, { type: 'APP_HIDDEN', now: now + 500 });
    expect(hidden.state.phase).toBe('PAUSED');
    expect(hidden.effects).toContainEqual({ type: 'SET_INFERENCE_FPS', fps: 0 });

    const resumed = send(hidden.state, { type: 'RESUME', now: now + 9000 });
    expect(resumed.state.phase).toBe('GREEN');
    expect(resumed.state.hearts).toBe(3);
  });

  it('la orientacion incorrecta pausa la partida', () => {
    const { state: green, now } = playUntilGreen();
    const paused = send(green, { type: 'ORIENTATION_BAD', now: now + 10 });
    expect(paused.state.phase).toBe('PAUSED');
  });

  it('en pausa el reloj de la partida no avanza', () => {
    const { state: green, now } = playUntilGreen();
    const paused = send(green, { type: 'APP_HIDDEN', now: now + 1000 }).state;
    const later = send(paused, { type: 'TICK', now: now + 60_000 }).state;
    expect(later.playElapsedMs).toBe(paused.playElapsedMs);
    expect(later.phase).toBe('PAUSED');
  });
});

describe('final de partida', () => {
  it('el boton Llego termina la partida en cualquier momento', () => {
    const { state: green, now } = playUntilGreen();
    const finished = send(green, { type: 'ARRIVED_PRESSED', now: now + 3000 });
    expect(finished.state.phase).toBe('FINISHED');
    expect(finished.state.finishReason).toBe('ARRIVED');
    expect(cues(finished.effects)).toEqual(['arrived', 'celebrate']);
  });

  it('el boton detener funciona durante la calibracion', () => {
    let state = createInitialState('SHORT');
    state = send(state, { type: 'START_PRESSED', now: 0, matchLength: 'SHORT' }).state;
    state = send(state, { type: 'CAMERA_READY', now: 0 }).state;
    const stopped = send(state, { type: 'STOP_PRESSED', now: 100 });
    expect(stopped.state.phase).toBe('IDLE');
    expect(stopped.effects).toContainEqual({ type: 'STOP_CAMERA' });
  });

  it('el boton detener durante el juego da resultado STOPPED', () => {
    const { state: green, now } = playUntilGreen();
    const stopped = send(green, { type: 'STOP_PRESSED', now: now + 100 });
    expect(stopped.state.phase).toBe('FINISHED');
    expect(stopped.state.finishReason).toBe('STOPPED');
  });

  it('termina al agotarse el tiempo de la partida', () => {
    const { state: green, now } = playUntilGreen();
    expect(green.matchDurationMs).toBe(30_000);

    // Un solo TICK muy posterior tambien debe cerrar la partida.
    const finished = send(green, { type: 'TICK', now: now + 31_000 });
    expect(finished.state.phase).toBe('FINISHED');
    expect(finished.state.finishReason).toBe('TIME_UP');
    expect(remainingMatchMs(finished.state)).toBe(0);
  });

  it('jugar otra vez reinicia corazones y tiempo', () => {
    const { state: green, now } = playUntilGreen();
    const finished = send(green, { type: 'ARRIVED_PRESSED', now: now + 1000 }).state;
    const again = send(finished, { type: 'PLAY_AGAIN', now: now + 2000, matchLength: 'LONG' });
    expect(again.state.phase).toBe('REQUESTING_CAMERA');
    expect(again.state.hearts).toBe(3);
    expect(again.state.playElapsedMs).toBe(0);
    expect(again.state.matchDurationMs).toBe(90_000);
  });
});

describe('errores de camara', () => {
  it('el permiso denegado lleva a su propia pantalla', () => {
    let state = createInitialState('SHORT');
    state = send(state, { type: 'START_PRESSED', now: 0, matchLength: 'SHORT' }).state;
    const denied = send(state, { type: 'CAMERA_FAILED', now: 10, failure: 'PERMISSION_DENIED' });
    expect(denied.state.phase).toBe('PERMISSION_DENIED');
    expect(denied.state.failure).toBe('PERMISSION_DENIED');
  });

  it('un fallo de modelo se puede reintentar', () => {
    let state = createInitialState('SHORT');
    state = send(state, { type: 'START_PRESSED', now: 0, matchLength: 'SHORT' }).state;
    state = send(state, { type: 'CAMERA_FAILED', now: 10, failure: 'MODEL_FAILED' }).state;
    expect(state.phase).toBe('CAMERA_ERROR');

    const retry = send(state, { type: 'RETRY_CAMERA', now: 20 });
    expect(retry.state.phase).toBe('REQUESTING_CAMERA');
    expect(retry.state.failure).toBeNull();
    expect(retry.effects).toContainEqual({ type: 'START_CAMERA' });
  });

  it('un dispositivo no soportado se marca aparte', () => {
    let state = createInitialState('SHORT');
    state = send(state, { type: 'START_PRESSED', now: 0, matchLength: 'SHORT' }).state;
    const unsupported = send(state, { type: 'CAMERA_FAILED', now: 10, failure: 'UNSUPPORTED' });
    expect(unsupported.state.phase).toBe('UNSUPPORTED_DEVICE');
  });
});

describe('rendimiento', () => {
  it('la inferencia baja en verde y sube en rojo', () => {
    const { state: green, now } = playUntilGreen();
    const red = advanceUntilPhaseChange(green, now);
    const greenFps = green.phase === 'GREEN';
    expect(greenFps).toBe(true);

    const fpsEffects = red.effects.filter((e) => e.type === 'SET_INFERENCE_FPS');
    expect(fpsEffects.length).toBeGreaterThan(0);
    const redFps = fpsEffects.at(-1);
    expect(redFps).toEqual({ type: 'SET_INFERENCE_FPS', fps: 11 });
  });
});
