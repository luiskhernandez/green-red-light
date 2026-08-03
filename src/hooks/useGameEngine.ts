import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { CameraController, CameraError } from '../camera/CameraController';
import { FrameScheduler, type SchedulerStats } from '../camera/frameScheduler';
import { PoseDetector } from '../camera/PoseDetector';
import { getTestHarness, type TestHarness } from '../camera/testHarness';
import { checkCalibration, type CalibrationCheck } from '../game/calibration';
import {
  MIN_PENALTY_CONFIDENCE,
  MOVEMENT_CONSECUTIVE_FRAMES,
  MOVEMENT_THRESHOLD,
  MATCH_DURATION_MS,
  PLAYER_LOCK_MS,
  PLAYER_LOST_GRACE_MS,
  PLAYER_RECOVER_MS,
  SLOW_INFERENCE_MS,
  SLOW_INFERENCE_SAMPLES,
} from '../game/gameConfig';
import {
  createInitialState,
  isInMatch,
  isPlayPhase,
  reduce,
  type GameEvent,
} from '../game/gameMachine';
import type {
  BoundingBox,
  Effect,
  GameState,
  PlayerSignature,
  Pose,
} from '../game/gameTypes';
import {
  blendSignature,
  pickCalibrationCandidate,
  selectPlayerPose,
  signatureFrom,
  toCandidates,
  type PoseCandidate,
} from '../game/playerTracking';
import {
  createReferencePose,
  MovementTracker,
  scoreMovement,
  type ReferencePose,
} from '../game/movementScoring';
import { isDebugEnabled, useSettingsStore } from '../game/settingsStore';
import { useDocumentVisible } from './useDocumentVisible';
import { useIsLandscape, tryLockLandscape } from './useOrientation';
import { useWakeLock } from './useWakeLock';

/**
 * Orquestador: une camara, deteccion de pose, seguimiento, audio y la maquina
 * de estados. Toda la logica de decision vive en src/game/*; aqui solo
 * conectamos cables y ejecutamos efectos.
 */

/** Movimiento tolerado mientras confirmamos al jugador (fraccion del cuerpo). */
const LOCK_STILLNESS_THRESHOLD = 0.22;

export interface DebugInfo {
  cameraFps: number;
  inferenceFps: number;
  inferenceMs: number;
  droppedFrames: number;
  throttled: boolean;
  movementScore: number;
  smoothedScore: number;
  consecutiveOverThreshold: number;
  poseConfidence: number;
  matchScore: number;
  posesInFrame: number;
  hasPlayer: boolean;
}

const EMPTY_DEBUG: DebugInfo = {
  cameraFps: 0,
  inferenceFps: 0,
  inferenceMs: 0,
  droppedFrames: 0,
  throttled: false,
  movementScore: 0,
  smoothedScore: 0,
  consecutiveOverThreshold: 0,
  poseConfidence: 0,
  matchScore: 0,
  posesInFrame: 0,
  hasPlayer: false,
};

export interface GameEngine {
  state: GameState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  calibration: CalibrationCheck;
  /** Caja del jugador seguido, en coordenadas normalizadas. */
  playerBox: BoundingBox | null;
  /** Landmarks del jugador seguido (solo se pintan en calibracion o debug). */
  playerPose: Pose | null;
  modelLoading: boolean;
  isLandscape: boolean;
  debug: DebugInfo;
  debugEnabled: boolean;
  actions: {
    start: () => void;
    playAgain: () => void;
    arrived: () => void;
    stop: () => void;
    goHome: () => void;
    retryCamera: () => void;
  };
}

export function useGameEngine(): GameEngine {
  const settings = useSettingsStore((s) => s.settings);
  const isLandscape = useIsLandscape();
  const isVisible = useDocumentVisible();
  const debugEnabled = useMemo(() => isDebugEnabled(), []);

  const [state, setState] = useState<GameState>(() =>
    createInitialState(settings.matchLength),
  );
  const [calibration, setCalibration] = useState<CalibrationCheck>({
    issue: 'NO_PLAYER',
    message: 'Buscando un jugador. Colocate frente al iPad.',
    missingParts: [],
  });
  const [playerBox, setPlayerBox] = useState<BoundingBox | null>(null);
  const [playerPose, setPlayerPose] = useState<Pose | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [debug, setDebug] = useState<DebugInfo>(EMPTY_DEBUG);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  // Solo tiene valor en pruebas end-to-end (?e2e=1 + window.__LVLR_E2E__).
  const harnessRef = useRef<TestHarness | null>(getTestHarness());

  const cameraRef = useRef<CameraController | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const schedulerRef = useRef<FrameScheduler | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const trackerRef = useRef<MovementTracker | null>(null);

  // Identidad del jugador. Vive solo durante la partida y nunca se persiste.
  const signatureRef = useRef<PlayerSignature | null>(null);
  const pendingSignatureRef = useRef<PlayerSignature | null>(null);
  const lastPlayerPoseRef = useRef<Pose | null>(null);
  const referenceRef = useRef<ReferencePose | null>(null);
  const needsReferenceRef = useRef(false);
  const lockReferenceRef = useRef<ReferencePose | null>(null);

  const readySinceRef = useRef<number | null>(null);
  const lastSeenAtRef = useRef(0);
  const recoveredSinceRef = useRef<number | null>(null);
  const lastMatchScoreRef = useRef(0);
  const posesInFrameRef = useRef(0);
  const statsRef = useRef<SchedulerStats>({
    cameraFps: 0,
    inferenceFps: 0,
    droppedFrames: 0,
    lastInferenceMs: 0,
    throttled: false,
  });

  settingsRef.current = settings;

  // --- Instancias perezosas (una sola vez por montaje) ---------------------

  const getCamera = () => (cameraRef.current ??= new CameraController());
  const getDetector = () => (detectorRef.current ??= new PoseDetector());
  const getAudio = () => (audioRef.current ??= new AudioEngine());
  const getTracker = () =>
    (trackerRef.current ??= new MovementTracker(
      MOVEMENT_THRESHOLD[settingsRef.current.sensitivity],
      MOVEMENT_CONSECUTIVE_FRAMES[settingsRef.current.sensitivity],
      MIN_PENALTY_CONFIDENCE,
    ));

  // --- Despacho de eventos y ejecucion de efectos --------------------------

  const dispatchRef = useRef<(event: GameEvent) => void>(() => {});

  const clearPlayer = useCallback(() => {
    signatureRef.current = null;
    pendingSignatureRef.current = null;
    lastPlayerPoseRef.current = null;
    referenceRef.current = null;
    lockReferenceRef.current = null;
    needsReferenceRef.current = false;
    readySinceRef.current = null;
    recoveredSinceRef.current = null;
    lastMatchScoreRef.current = 0;
    setPlayerBox(null);
    setPlayerPose(null);
    trackerRef.current?.reset();
  }, []);

  const startCamera = useCallback(async () => {
    if (harnessRef.current) {
      // Pruebas end-to-end: sin getUserMedia y sin descargar el modelo.
      dispatchRef.current({ type: 'CAMERA_READY', now: performance.now() });
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setModelLoading(true);
    try {
      // La camara se pide primero para que el dialogo de permiso aparezca
      // enseguida; el modelo se descarga en paralelo.
      const cameraStart = getCamera().start(video);
      const modelLoad = getDetector().load();
      await cameraStart;
      await modelLoad;
      dispatchRef.current({ type: 'CAMERA_READY', now: performance.now() });
    } catch (error) {
      const failure =
        error instanceof CameraError ? error.failure : ('MODEL_FAILED' as const);
      dispatchRef.current({ type: 'CAMERA_FAILED', now: performance.now(), failure });
    } finally {
      setModelLoading(false);
    }
  }, []);

  const runEffect = useCallback(
    (effect: Effect) => {
      switch (effect.type) {
        case 'SAY':
          getAudio().play(effect.cue);
          break;
        case 'SET_INFERENCE_FPS':
          schedulerRef.current?.setTargetFps(effect.fps);
          break;
        case 'START_CAMERA':
          void startCamera();
          break;
        case 'STOP_CAMERA':
          getCamera().stop();
          schedulerRef.current?.setTargetFps(0);
          break;
        case 'LOCK_PLAYER':
          signatureRef.current = pendingSignatureRef.current;
          lockReferenceRef.current = null;
          break;
        case 'CLEAR_PLAYER':
          clearPlayer();
          break;
        case 'RESET_MOVEMENT':
          getTracker().reset();
          referenceRef.current = null;
          break;
        case 'CAPTURE_REFERENCE_POSE': {
          const pose = lastPlayerPoseRef.current;
          const reference = pose ? createReferencePose(pose) : null;
          referenceRef.current = reference;
          // Si aun no teniamos pose util, el siguiente frame la captura.
          needsReferenceRef.current = reference === null;
          getTracker().reset();
          break;
        }
      }
    },
    [clearPlayer, startCamera],
  );

  const dispatch = useCallback(
    (event: GameEvent) => {
      const { state: next, effects } = reduce(stateRef.current, event, { rng: Math.random });
      if (next !== stateRef.current) {
        stateRef.current = next;
        setState(next);
      }
      for (const effect of effects) runEffect(effect);
    },
    [runEffect],
  );

  dispatchRef.current = dispatch;

  // --- Bucle de inferencia -------------------------------------------------

  const handleCalibrating = useCallback(
    (candidates: PoseCandidate[], now: number) => {
      const chosen = pickCalibrationCandidate(candidates);
      const check = checkCalibration(candidates, chosen);
      setCalibration(check);

      if (chosen) {
        setPlayerBox(chosen.metrics.boundingBox);
        setPlayerPose(chosen.pose);
        lastPlayerPoseRef.current = chosen.pose;
        pendingSignatureRef.current = signatureFrom(chosen.metrics);
      } else {
        setPlayerBox(null);
        setPlayerPose(null);
      }

      if (check.issue !== 'READY') {
        readySinceRef.current = null;
        return;
      }
      readySinceRef.current ??= now;
      // Requisito del PRD: visible y correcto durante 2 s continuos.
      if (now - readySinceRef.current >= PLAYER_LOCK_MS) {
        readySinceRef.current = null;
        dispatchRef.current({ type: 'CALIBRATION_OK', now });
      }
    },
    [],
  );

  const handleLocking = useCallback((candidates: PoseCandidate[], now: number) => {
    const signature = pendingSignatureRef.current;
    const match = signature
      ? selectPlayerPose(candidates, signature, signature.center)
      : pickCalibrationCandidate(candidates)
        ? { candidate: pickCalibrationCandidate(candidates)!, score: 1 }
        : null;

    if (!match) {
      // Perdimos al candidato: volvemos a buscar en vez de fijar a nadie.
      lockReferenceRef.current = null;
      dispatchRef.current({ type: 'LOCK_ABORTED', now });
      return;
    }

    setPlayerBox(match.candidate.metrics.boundingBox);
    setPlayerPose(match.candidate.pose);
    lastPlayerPoseRef.current = match.candidate.pose;
    pendingSignatureRef.current = signature
      ? blendSignature(signature, signatureFrom(match.candidate.metrics), 0.3)
      : signatureFrom(match.candidate.metrics);

    // Exigimos quietud: comparamos contra la primera pose de esta fase.
    if (!lockReferenceRef.current) {
      lockReferenceRef.current = createReferencePose(match.candidate.pose);
      return;
    }
    const moved = scoreAgainst(lockReferenceRef.current, match.candidate.pose);
    if (moved !== null && moved > LOCK_STILLNESS_THRESHOLD) {
      lockReferenceRef.current = null;
      dispatchRef.current({ type: 'LOCK_ABORTED', now });
    }
  }, []);

  const handlePlaying = useCallback(
    (candidates: PoseCandidate[], now: number, detecting: boolean) => {
      const signature = signatureRef.current;
      if (!signature) return;

      const match = selectPlayerPose(candidates, signature, signature.center);
      if (!match) {
        lastMatchScoreRef.current = 0;
        // Menos de un segundo sin verlo no es nada: mantenemos la identidad.
        if (now - lastSeenAtRef.current > PLAYER_LOST_GRACE_MS) {
          dispatchRef.current({ type: 'PLAYER_LOST', now });
        }
        return;
      }

      lastSeenAtRef.current = now;
      lastMatchScoreRef.current = match.score;
      const pose = match.candidate.pose;
      lastPlayerPoseRef.current = pose;
      signatureRef.current = blendSignature(
        signature,
        signatureFrom(match.candidate.metrics),
      );
      if (settingsRef.current.preview !== 'HIDDEN' || debugEnabled) {
        setPlayerBox(match.candidate.metrics.boundingBox);
        setPlayerPose(pose);
      }

      if (!detecting) return;

      if (needsReferenceRef.current || !referenceRef.current) {
        referenceRef.current = createReferencePose(pose);
        needsReferenceRef.current = referenceRef.current === null;
        return;
      }

      const tracker = getTracker();
      tracker.configure(
        MOVEMENT_THRESHOLD[settingsRef.current.sensitivity],
        MOVEMENT_CONSECUTIVE_FRAMES[settingsRef.current.sensitivity],
      );
      if (tracker.push(scoreMovement(referenceRef.current, pose))) {
        dispatchRef.current({ type: 'MOVEMENT_DETECTED', now });
      }
    },
    [debugEnabled],
  );

  const handleLost = useCallback((candidates: PoseCandidate[], now: number) => {
    const signature = signatureRef.current;
    if (!signature) return;
    const match = selectPlayerPose(candidates, signature, signature.center);
    if (!match) {
      recoveredSinceRef.current = null;
      setPlayerBox(null);
      setPlayerPose(null);
      return;
    }
    setPlayerBox(match.candidate.metrics.boundingBox);
    setPlayerPose(match.candidate.pose);
    lastPlayerPoseRef.current = match.candidate.pose;
    lastMatchScoreRef.current = match.score;
    recoveredSinceRef.current ??= now;
    // Pedimos que se quede un momento antes de reanudar, para no reanudar en
    // pleno tropiezo.
    if (now - recoveredSinceRef.current >= PLAYER_RECOVER_MS) {
      recoveredSinceRef.current = null;
      lastSeenAtRef.current = now;
      dispatchRef.current({ type: 'PLAYER_RECOVERED', now });
    }
  }, []);

  /**
   * Un frame: inferencia + decision segun la fase.
   * Solo lee `stateRef`, nunca `state`, para no depender del ciclo de render.
   */
  const handleFrame = useCallback(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    let poses: Pose[];
    const harness = harnessRef.current;
    if (harness) {
      poses = harness.poses();
    } else {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) return;
      const frame = detector.detect(video, performance.now());
      if (!frame) return;
      scheduler.reportInference(frame.inferenceMs);
      poses = frame.poses;
    }
    statsRef.current = scheduler.getStats();

    const now = performance.now();
    const candidates = toCandidates(poses);
    posesInFrameRef.current = poses.length;
    const phase = stateRef.current.phase;

    if (phase === 'CALIBRATING') return handleCalibrating(candidates, now);
    if (phase === 'LOCKING_PLAYER') return handleLocking(candidates, now);
    if (phase === 'PLAYER_LOST') return handleLost(candidates, now);
    if (isPlayPhase(phase)) handlePlaying(candidates, now, phase === 'RED_DETECTION');
  }, [handleCalibrating, handleLocking, handleLost, handlePlaying]);

  // El scheduler se crea una vez; lee el handler vigente desde este ref.
  const frameRef = useRef(handleFrame);
  frameRef.current = handleFrame;

  useEffect(() => {
    schedulerRef.current = new FrameScheduler(
      () => frameRef.current(),
      SLOW_INFERENCE_MS,
      SLOW_INFERENCE_SAMPLES,
    );
    return () => {
      schedulerRef.current?.reset();
      schedulerRef.current = null;
    };
  }, []);

  // --- Reloj del juego -----------------------------------------------------

  useEffect(() => {
    if (state.phase === 'IDLE' || state.phase === 'FINISHED') return;
    const id = window.setInterval(() => {
      dispatchRef.current({ type: 'TICK', now: performance.now() });
    }, 50);
    return () => window.clearInterval(id);
  }, [state.phase]);

  // --- Sincronizacion de ajustes ------------------------------------------

  useEffect(() => {
    getAudio().setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    trackerRef.current?.configure(
      MOVEMENT_THRESHOLD[settings.sensitivity],
      MOVEMENT_CONSECUTIVE_FRAMES[settings.sensitivity],
    );
  }, [settings.sensitivity]);

  // Cambiar la duracion fuera de partida se refleja de inmediato.
  useEffect(() => {
    if (stateRef.current.phase !== 'IDLE') return;
    const next = { ...stateRef.current, matchDurationMs: MATCH_DURATION_MS[settings.matchLength] };
    stateRef.current = next;
    setState(next);
  }, [settings.matchLength]);

  // --- App en segundo plano y orientacion ---------------------------------

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      audioRef.current?.stopAll();
      dispatchRef.current({ type: 'APP_HIDDEN', now: performance.now() });
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onHidden);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onHidden);
    };
  }, []);

  useEffect(() => {
    if (isLandscape) return;
    dispatchRef.current({ type: 'ORIENTATION_BAD', now: performance.now() });
  }, [isLandscape]);

  useWakeLock(isInMatch(state.phase) || state.phase === 'CALIBRATING');

  // --- Overlay de desarrollo ---------------------------------------------

  useEffect(() => {
    if (!debugEnabled) return;
    const id = window.setInterval(() => {
      const tracker = trackerRef.current;
      const stats = statsRef.current;
      setDebug({
        cameraFps: stats.cameraFps,
        inferenceFps: stats.inferenceFps,
        inferenceMs: Math.round(stats.lastInferenceMs * 10) / 10,
        droppedFrames: stats.droppedFrames,
        throttled: stats.throttled,
        movementScore: round(tracker?.score ?? 0),
        smoothedScore: round(tracker?.smoothedScore ?? 0),
        consecutiveOverThreshold: tracker?.consecutiveOverThreshold ?? 0,
        poseConfidence: round(referenceRef.current?.metrics.confidence ?? 0),
        matchScore: round(lastMatchScoreRef.current),
        posesInFrame: posesInFrameRef.current,
        hasPlayer: signatureRef.current !== null,
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [debugEnabled]);

  // --- Limpieza -----------------------------------------------------------

  useEffect(
    () => () => {
      cameraRef.current?.stop();
      detectorRef.current?.close();
      audioRef.current?.dispose();
    },
    [],
  );

  // --- Acciones expuestas a la interfaz ----------------------------------

  const actions = useMemo(
    () => ({
      start: () => {
        // El gesto del usuario es el unico momento en que Safari nos deja
        // desbloquear el audio y pedir la camara.
        void getAudio().unlock();
        void tryLockLandscape();
        clearPlayer();
        dispatchRef.current({
          type: 'START_PRESSED',
          now: performance.now(),
          matchLength: settingsRef.current.matchLength,
        });
      },
      playAgain: () => {
        void getAudio().unlock();
        clearPlayer();
        dispatchRef.current({
          type: 'PLAY_AGAIN',
          now: performance.now(),
          matchLength: settingsRef.current.matchLength,
        });
      },
      arrived: () => dispatchRef.current({ type: 'ARRIVED_PRESSED', now: performance.now() }),
      stop: () => dispatchRef.current({ type: 'STOP_PRESSED', now: performance.now() }),
      goHome: () => dispatchRef.current({ type: 'GO_HOME', now: performance.now() }),
      retryCamera: () => dispatchRef.current({ type: 'RETRY_CAMERA', now: performance.now() }),
    }),
    [clearPlayer],
  );

  // Reanudamos solos cuando se vuelve a la app y el iPad esta horizontal.
  // `isVisible` tiene que ser estado, no un listener: si no, al volver del
  // segundo plano nada re-dispara este efecto y la partida se queda pausada.
  useEffect(() => {
    if (state.phase !== 'PAUSED' || !isLandscape || !isVisible) return;
    const id = window.setTimeout(
      () => dispatchRef.current({ type: 'RESUME', now: performance.now() }),
      600,
    );
    return () => window.clearTimeout(id);
  }, [state.phase, isLandscape, isVisible]);

  return {
    state,
    videoRef,
    calibration,
    playerBox,
    playerPose,
    modelLoading,
    isLandscape,
    debug,
    debugEnabled,
    actions,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Solo el puntaje, para la comprobacion de quietud durante el bloqueo. */
function scoreAgainst(reference: ReferencePose, pose: Pose): number | null {
  return scoreMovement(reference, pose)?.score ?? null;
}
