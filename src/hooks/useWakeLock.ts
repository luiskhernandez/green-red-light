import { useEffect, useRef } from 'react';

interface WakeLockSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockNavigator {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
}

/**
 * Mantiene la pantalla encendida mientras hay partida.
 *
 * Safari en iPadOS aun no implementa Screen Wake Lock en todas las versiones;
 * si no existe, el juego funciona igual (el adulto toca la pantalla o sube el
 * tiempo de bloqueo en Ajustes). Por eso el fallo es silencioso.
 */
export function useWakeLock(active: boolean): void {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const wakeLock = (navigator as Navigator & WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let cancelled = false;

    const release = () => {
      const current = sentinel.current;
      sentinel.current = null;
      if (current && !current.released) void current.release().catch(() => {});
    };

    if (active) {
      wakeLock
        .request('screen')
        .then((lock) => {
          if (cancelled) {
            void lock.release().catch(() => {});
            return;
          }
          sentinel.current = lock;
        })
        .catch(() => {});
    } else {
      release();
    }

    return () => {
      cancelled = true;
      release();
    };
  }, [active]);
}
