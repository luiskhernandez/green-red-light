import { StopButton } from './StopButton';

interface CountdownScreenProps {
  /** 0 = aun se muestra el recordatorio de seguridad. */
  value: number;
  onStop: () => void;
}

export function CountdownScreen({ value, onStop }: CountdownScreenProps) {
  return (
    <div className="screen screen--countdown" data-testid="screen-countdown">
      {value === 0 ? (
        <>
          <h2 className="headline">Recuerda</h2>
          <p className="title">Camina despacio</p>
          <p className="lead">No corras.</p>
        </>
      ) : (
        <>
          <p className="lead">Preparate</p>
          {/* La key reinicia la animacion en cada numero. */}
          <p className="countdown-number" key={value} data-testid="countdown-value">
            {value}
          </p>
        </>
      )}
      <div className="hud hud--bottom">
        <StopButton onStop={onStop} />
      </div>
    </div>
  );
}
