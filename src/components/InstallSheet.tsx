/** Instrucciones para instalar la PWA en iPad (Safari no muestra prompt). */
export function InstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" data-testid="install-sheet">
      <div className="panel">
        <h2 className="headline">Instalar en el iPad</h2>
        <ol className="install-list">
          <li>Abre este juego en Safari.</li>
          <li>
            Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha).
          </li>
          <li>
            Elige <strong>Añadir a pantalla de inicio</strong>.
          </li>
          <li>
            Ábrelo desde el icono nuevo: se ve a pantalla completa y funciona sin conexión.
          </li>
        </ol>
        <p className="hint">
          La primera vez necesitas internet para descargar el detector de pose (unos 18 MB). Después
          queda guardado en el iPad.
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
