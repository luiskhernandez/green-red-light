import { Mascot } from './Mascot';

interface StartScreenProps {
  onStart: () => void;
  onOpenSettings: () => void;
  onOpenInstall: () => void;
}

export function StartScreen({ onStart, onOpenSettings, onOpenInstall }: StartScreenProps) {
  return (
    <div className="screen screen--start" data-testid="screen-start">
      <p className="badge">Juega acompañado por un adulto</p>
      <div className="start-hero">
        <Mascot mood="happy" />
        <h1 className="title">
          Luz Verde
          <br />
          Luz Roja
        </h1>
      </div>
      <p className="lead">Necesitas espacio para caminar.</p>
      <p className="note">
        Camina despacio. No corras. Coloca el iPad en un soporte estable y ponte al otro lado del
        espacio libre.
      </p>

      <button
        type="button"
        className="btn btn--huge btn--primary pulse"
        onClick={onStart}
        data-testid="start-button"
      >
        ▶ Empezar
      </button>

      <div className="btn-row">
        <button type="button" className="btn" onClick={onOpenSettings} data-testid="settings-button">
          ⚙️ Ajustes
        </button>
        <button type="button" className="btn" onClick={onOpenInstall}>
          📲 Instalar
        </button>
      </div>
    </div>
  );
}
