import { useState } from 'react';
import { CalibrationScreen } from '../components/CalibrationScreen';
import { CameraStage, type CameraMode } from '../components/CameraStage';
import { CountdownScreen } from '../components/CountdownScreen';
import { DebugOverlay } from '../components/DebugOverlay';
import { ErrorScreen } from '../components/ErrorScreen';
import { GameScreen } from '../components/GameScreen';
import { InstallSheet } from '../components/InstallSheet';
import { PlayerLostScreen } from '../components/PlayerLostScreen';
import { ResultScreen } from '../components/ResultScreen';
import { SettingsPanel } from '../components/SettingsPanel';
import { StartScreen } from '../components/StartScreen';
import { isPlayPhase } from '../game/gameMachine';
import { useSettingsStore } from '../game/settingsStore';
import { useGameEngine } from '../hooks/useGameEngine';
import type { Phase } from '../game/gameTypes';

/**
 * Cascara de la aplicacion: una sola pantalla que cambia segun la fase de la
 * maquina de estados. Sin router, sin backend.
 *
 * El CameraStage se renderiza SIEMPRE y en el mismo lugar del arbol, para que
 * el <video> nunca se remonte.
 */
export function App() {
  const engine = useGameEngine();
  const settings = useSettingsStore((s) => s.settings);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstall, setShowInstall] = useState(false);

  const { state, actions } = engine;
  const cameraMode = resolveCameraMode(state.phase, settings.preview);
  const showGuideZone = state.phase === 'CALIBRATING' || state.phase === 'PLAYER_LOST';
  // Durante la partida no dibujamos landmarks: gasta GPU y distrae.
  const showLandmarks = showGuideZone || state.phase === 'LOCKING_PLAYER' || engine.debugEnabled;

  return (
    <>
      <CameraStage
        videoRef={engine.videoRef}
        mode={cameraMode}
        showZone={showGuideZone}
        zoneReady={engine.calibration.issue === 'READY' || engine.playerBox !== null}
        playerBox={cameraMode === 'background' || engine.debugEnabled ? engine.playerBox : null}
        playerLocked={state.phase !== 'CALIBRATING'}
        landmarks={showLandmarks ? engine.playerPose : null}
        mirrored={engine.mirrored}
      />

      {renderScreen()}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showInstall && <InstallSheet onClose={() => setShowInstall(false)} />}

      {!engine.isLandscape && (
        <div className="overlay" data-testid="orientation-warning">
          <div>
            <p className="title">🔄</p>
            <h2 className="headline">Gira el iPad</h2>
            <p className="lead">El juego se juega en horizontal.</p>
          </div>
        </div>
      )}

      {engine.debugEnabled && (
        <DebugOverlay info={engine.debug} state={state} sensitivity={settings.sensitivity} />
      )}
    </>
  );

  function renderScreen() {
    switch (state.phase) {
      case 'IDLE':
        return (
          <StartScreen
            onStart={actions.start}
            onOpenSettings={() => setShowSettings(true)}
            onOpenInstall={() => setShowInstall(true)}
          />
        );

      case 'REQUESTING_CAMERA':
        return (
          <div className="screen screen--calibrating" data-testid="screen-requesting">
            <div className="spinner" />
            <h2 className="headline">Pidiendo permiso para la cámara</h2>
            <p className="lead">Toca “Permitir” cuando Safari lo pregunte.</p>
            <p className="note">
              El video se procesa solo en este iPad. No se graba ni se envía a ningún servidor.
            </p>
            <div className="hud hud--bottom">
              <button type="button" className="btn btn--ghost" onClick={actions.stop}>
                Cancelar
              </button>
            </div>
          </div>
        );

      case 'CALIBRATING':
      case 'LOCKING_PLAYER':
        return (
          <CalibrationScreen
            calibration={engine.calibration}
            locking={state.phase === 'LOCKING_PLAYER'}
            modelLoading={engine.modelLoading}
            frontCamera={engine.mirrored}
            onStop={actions.stop}
            onFlipCamera={actions.flipCamera}
          />
        );

      case 'COUNTDOWN':
        return <CountdownScreen value={state.countdownValue} onStop={actions.stop} />;

      case 'GREEN':
      case 'RED_GRACE_PERIOD':
      case 'RED_DETECTION':
      case 'MOVEMENT_WARNING':
        return <GameScreen state={state} onArrived={actions.arrived} onStop={actions.stop} />;

      case 'PLAYER_LOST':
        return (
          <PlayerLostScreen
            playerVisible={engine.playerBox !== null}
            onStop={actions.stop}
            onArrived={actions.arrived}
          />
        );

      case 'PAUSED':
        return (
          <div className="screen screen--lost" data-testid="screen-paused">
            <h2 className="headline">Juego en pausa</h2>
            <p className="lead">
              {engine.isLandscape
                ? 'Vuelve a la app para seguir jugando.'
                : 'Gira el iPad a horizontal para seguir.'}
            </p>
            <p className="note">Los corazones y el tiempo se guardaron.</p>
            <div className="hud hud--bottom">
              <button type="button" className="btn btn--danger" onClick={actions.stop}>
                ✋ Detener
              </button>
            </div>
          </div>
        );

      case 'FINISHED':
        return (
          <ResultScreen
            reason={state.finishReason ?? 'STOPPED'}
            hearts={state.hearts}
            playedSeconds={Math.round(state.playElapsedMs / 1000)}
            onPlayAgain={actions.playAgain}
            onOpenSettings={() => setShowSettings(true)}
            onGoHome={actions.goHome}
          />
        );

      case 'PERMISSION_DENIED':
      case 'CAMERA_ERROR':
      case 'UNSUPPORTED_DEVICE':
        return (
          <ErrorScreen
            failure={state.failure ?? 'NO_CAMERA'}
            onRetry={actions.retryCamera}
            onGoHome={actions.goHome}
          />
        );

      default:
        return null;
    }
  }
}

/**
 * Cuanta camara se ve en cada fase.
 * Por defecto la vista esta oculta durante la partida (decision del PRD).
 */
function resolveCameraMode(phase: Phase, preview: string): CameraMode {
  if (phase === 'CALIBRATING' || phase === 'LOCKING_PLAYER' || phase === 'PLAYER_LOST') {
    return 'background';
  }
  if (isPlayPhase(phase)) {
    if (preview === 'VISIBLE') return 'large';
    if (preview === 'THUMBNAIL') return 'thumb';
    return 'hidden';
  }
  return 'hidden';
}
