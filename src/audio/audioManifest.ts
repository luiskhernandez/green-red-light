import type { AudioCue, Volume } from '../game/gameTypes';

/**
 * Manifiesto de audio.
 *
 * Decision de diseño: no enviamos archivos .mp3. Cada senal se genera con la
 * Web Audio API (tonos sintetizados) y la voz usa SpeechSynthesis, que en
 * Safari/iPadOS corre en el dispositivo. Asi el juego no depende de ningun
 * servicio remoto de TTS ni de descargar binarios, y cumple "funcionamiento
 * local despues de cargar la aplicacion".
 *
 * Si mas adelante se quieren locuciones grabadas, basta poner los archivos en
 * `public/audio/<cue>.mp3` y rellenar `file` en la entrada correspondiente:
 * AudioEngine los usara en lugar de la voz sintetizada.
 */

export interface Tone {
  /** Frecuencia en Hz. */
  freq: number;
  /** Duracion en segundos. */
  duration: number;
  /** Retraso respecto al inicio de la senal, en segundos. */
  at?: number;
  type?: OscillatorType;
  gain?: number;
}

export interface AudioCueDefinition {
  /** Texto que se dice en voz alta (es). Cadena vacia = solo sonido. */
  speech: string;
  /** Sonido sintetizado que acompaña o sustituye a la voz. */
  tones: Tone[];
  /** Archivo local opcional bajo public/audio/. Placeholder por ahora. */
  file?: string;
  /** Las senales urgentes interrumpen la voz en curso. */
  interrupt?: boolean;
}

const beep = (freq: number, duration = 0.14, type: OscillatorType = 'sine'): Tone[] => [
  { freq, duration, type },
];

export const AUDIO_CUES: Record<AudioCue, AudioCueDefinition> = {
  playerFound: {
    speech: 'Jugador encontrado',
    tones: [
      { freq: 660, duration: 0.12, type: 'triangle' },
      { freq: 880, duration: 0.16, at: 0.12, type: 'triangle' },
    ],
  },
  stayStill: { speech: 'Quedate quieto', tones: beep(520, 0.18, 'triangle') },
  playerLocked: {
    speech: 'Listo. Te seguire a ti',
    tones: [
      { freq: 720, duration: 0.1, type: 'triangle' },
      { freq: 960, duration: 0.1, at: 0.1, type: 'triangle' },
      { freq: 1200, duration: 0.18, at: 0.2, type: 'triangle' },
    ],
  },
  walkSlowly: {
    speech: 'Recuerda: camina despacio. No corras',
    tones: beep(440, 0.2, 'sine'),
    interrupt: true,
  },
  count5: { speech: 'cinco', tones: beep(520, 0.12, 'square'), interrupt: true },
  count4: { speech: 'cuatro', tones: beep(560, 0.12, 'square'), interrupt: true },
  count3: { speech: 'tres', tones: beep(620, 0.12, 'square'), interrupt: true },
  count2: { speech: 'dos', tones: beep(700, 0.12, 'square'), interrupt: true },
  count1: { speech: 'uno', tones: beep(800, 0.12, 'square'), interrupt: true },
  greenLight: {
    speech: 'Luz verde',
    tones: [
      { freq: 600, duration: 0.12, type: 'triangle' },
      { freq: 900, duration: 0.2, at: 0.12, type: 'triangle' },
    ],
    interrupt: true,
  },
  redLight: {
    speech: 'Luz roja',
    tones: [
      { freq: 420, duration: 0.14, type: 'square' },
      { freq: 280, duration: 0.24, at: 0.14, type: 'square' },
    ],
    interrupt: true,
  },
  sawYouMove: {
    speech: 'Te vi moverte. Quedate como estatua',
    tones: [
      { freq: 500, duration: 0.1, type: 'triangle' },
      { freq: 380, duration: 0.1, at: 0.1, type: 'triangle' },
      { freq: 500, duration: 0.16, at: 0.2, type: 'triangle' },
    ],
    interrupt: true,
  },
  cantSeeYou: {
    speech: 'No puedo verte. Vuelve a la zona de juego',
    tones: [
      { freq: 340, duration: 0.18, type: 'sine' },
      { freq: 300, duration: 0.22, at: 0.18, type: 'sine' },
    ],
    interrupt: true,
  },
  arrived: { speech: 'Llegaste', tones: beep(880, 0.2, 'triangle'), interrupt: true },
  celebrate: {
    speech: '',
    tones: [
      { freq: 660, duration: 0.12, type: 'triangle' },
      { freq: 830, duration: 0.12, at: 0.12, type: 'triangle' },
      { freq: 990, duration: 0.12, at: 0.24, type: 'triangle' },
      { freq: 1320, duration: 0.3, at: 0.36, type: 'triangle' },
    ],
  },
  matchComplete: { speech: 'Partida completada', tones: beep(900, 0.2, 'triangle') },
  tryAgainSlower: {
    speech: 'Probemos otra vez caminando mas despacio',
    tones: [
      { freq: 520, duration: 0.14, type: 'sine' },
      { freq: 440, duration: 0.2, at: 0.14, type: 'sine' },
    ],
  },
};

export const VOLUME_GAIN: Record<Volume, number> = {
  MUTE: 0,
  LOW: 0.25,
  HIGH: 0.7,
};
