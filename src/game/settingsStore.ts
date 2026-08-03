import { create } from 'zustand';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './gameConfig';
import type { Settings } from './gameTypes';

/**
 * Ajustes para adultos. Se guardan en localStorage porque son preferencias del
 * dispositivo, no datos del jugador. No se guarda nada del niño.
 */

function load(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persist(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Modo privado de Safari puede bloquear localStorage: seguimos en memoria.
  }
}

interface SettingsStore {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: typeof localStorage === 'undefined' ? DEFAULT_SETTINGS : load(),
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    persist(next);
    set({ settings: next });
  },
  reset: () => {
    persist(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));

/** El modo desarrollador se activa con ?debug=true (PRD seccion 12). */
export function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const value = params.get('debug');
  return value === 'true' || value === '1';
}
