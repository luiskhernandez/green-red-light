import type { CameraFailure } from '../game/gameTypes';

interface ErrorScreenProps {
  failure: CameraFailure;
  onRetry: () => void;
  onGoHome: () => void;
}

/** Instrucciones concretas para Safari en iPad, no un mensaje genérico. */
export function ErrorScreen({ failure, onRetry, onGoHome }: ErrorScreenProps) {
  return (
    <div className="screen screen--error" data-testid="screen-error" data-failure={failure}>
      <h2 className="headline">{TITLES[failure]}</h2>
      {failure === 'PERMISSION_DENIED' ? (
        <ol className="install-list">
          <li>Abre Ajustes del iPad.</li>
          <li>Entra en Apps → Safari → Cámara.</li>
          <li>Elige “Preguntar” o “Permitir”.</li>
          <li>Vuelve aquí y toca “Reintentar”.</li>
        </ol>
      ) : (
        <p className="lead">{MESSAGES[failure]}</p>
      )}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onRetry}
          data-testid="retry-button"
        >
          🔄 Reintentar
        </button>
        <button type="button" className="btn btn--ghost" onClick={onGoHome}>
          🏠 Volver al inicio
        </button>
      </div>
    </div>
  );
}

const TITLES: Record<CameraFailure, string> = {
  PERMISSION_DENIED: 'Necesitamos permiso para la cámara',
  NO_CAMERA: 'No encontramos una cámara disponible',
  MODEL_FAILED: 'No pudimos cargar el detector',
  UNSUPPORTED: 'Este dispositivo no puede jugar',
};

const MESSAGES: Record<CameraFailure, string> = {
  PERMISSION_DENIED: 'Habilita la cámara en Ajustes de Safari.',
  NO_CAMERA: 'Revisa que ninguna otra app esté usando la cámara y vuelve a intentarlo.',
  MODEL_FAILED:
    'Conéctate a internet una vez para descargar el detector. Después el juego funciona sin conexión.',
  UNSUPPORTED:
    'Necesitamos un navegador con cámara y WebAssembly. Prueba con Safari en un iPad reciente.',
};
