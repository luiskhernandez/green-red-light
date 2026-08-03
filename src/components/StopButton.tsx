/** Boton de detener. Debe estar visible en todo momento durante el juego. */
export function StopButton({ onStop }: { onStop: () => void }) {
  return (
    <button type="button" className="btn btn--danger" onClick={onStop} data-testid="stop-button">
      ✋ Detener
    </button>
  );
}
