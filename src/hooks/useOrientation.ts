import { useEffect, useState } from 'react';

/**
 * Reporta si el dispositivo esta en horizontal.
 *
 * El juego se diseño para el iPad acostado sobre un soporte. En vertical el
 * encuadre casi nunca alcanza para ver el cuerpo completo, asi que pausamos y
 * pedimos girar (PRD seccion 18).
 */
export function useIsLandscape(): boolean {
  const [landscape, setLandscape] = useState(() => read());

  useEffect(() => {
    const update = () => setLandscape(read());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const media = window.matchMedia?.('(orientation: landscape)');
    media?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      media?.removeEventListener?.('change', update);
    };
  }, []);

  return landscape;
}

function read(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia?.('(orientation: landscape)').matches) return true;
  return window.innerWidth >= window.innerHeight;
}

/**
 * Intenta bloquear la orientacion horizontal. Solo funciona en modo standalone
 * en navegadores que implementan ScreenOrientation.lock (no Safari hoy).
 */
export async function tryLockLandscape(): Promise<void> {
  const orientation = screen.orientation as
    | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
    | undefined;
  try {
    await orientation?.lock?.('landscape');
  } catch {
    // Safari lanza NotSupportedError: seguimos con el aviso visual.
  }
}
