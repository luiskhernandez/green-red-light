import { MATCH_DURATION_MS, MOVEMENT_THRESHOLD } from '../game/gameConfig';
import { useSettingsStore } from '../game/settingsStore';
import type { MatchLength, PreviewMode, Sensitivity, Volume } from '../game/gameTypes';

/** Panel para adultos. Pocas opciones, botones grandes, sin menus anidados. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update, reset } = useSettingsStore();

  return (
    <div className="overlay" data-testid="settings-panel">
      <div className="panel">
        <h2 className="headline">Ajustes</h2>

        <Group title="Sensibilidad al movimiento">
          <Row<Sensitivity>
            value={settings.sensitivity}
            onChange={(sensitivity) => update({ sensitivity })}
            options={[
              ['LOW', 'Baja'],
              ['NORMAL', 'Normal'],
              ['HIGH', 'Alta'],
            ]}
          />
          <p className="hint">
            Umbral actual: {MOVEMENT_THRESHOLD[settings.sensitivity].toFixed(2)} del tamaño del
            cuerpo. Mas alta = detecta movimientos mas pequeños.
          </p>
        </Group>

        <Group title="Duracion de la partida">
          <Row<MatchLength>
            value={settings.matchLength}
            onChange={(matchLength) => update({ matchLength })}
            options={[
              ['SHORT', 'Corta'],
              ['NORMAL', 'Normal'],
              ['LONG', 'Larga'],
            ]}
          />
          <p className="hint">
            {Math.round(MATCH_DURATION_MS[settings.matchLength] / 1000)} segundos de juego.
          </p>
        </Group>

        <Group title="Volumen">
          <Row<Volume>
            value={settings.volume}
            onChange={(volume) => update({ volume })}
            options={[
              ['MUTE', 'Silencio'],
              ['LOW', 'Bajo'],
              ['HIGH', 'Alto'],
            ]}
          />
        </Group>

        <Group title="Vista de camara durante el juego">
          <Row<PreviewMode>
            value={settings.preview}
            onChange={(preview) => update({ preview })}
            options={[
              ['HIDDEN', 'Oculta'],
              ['THUMBNAIL', 'Miniatura'],
              ['VISIBLE', 'Visible'],
            ]}
          />
          <p className="hint">Oculta consume menos batería y distrae menos al niño.</p>
        </Group>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onClose}
            data-testid="settings-close"
          >
            Listo
          </button>
          <button type="button" className="btn" onClick={reset}>
            Restaurar
          </button>
        </div>

        <p className="hint">
          Modo desarrollador: añade <code>?debug=true</code> a la direccion.
        </p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="option-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Row<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="option-row">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className="chip"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          data-testid={`option-${key}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
