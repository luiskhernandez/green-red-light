import { useEffect, useState } from 'react';

/**
 * Si la app esta en primer plano.
 *
 * Hace falta como estado (y no solo como listener) porque al volver del
 * segundo plano hay que reanudar la partida, y para eso el efecto de reanudado
 * necesita re-ejecutarse cuando esto cambia.
 */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
}
