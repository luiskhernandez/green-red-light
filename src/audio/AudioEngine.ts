import { AUDIO_CUES, VOLUME_GAIN } from './audioManifest';
import type { AudioCue, Volume } from '../game/gameTypes';

/**
 * Motor de audio: tonos con Web Audio + voz con SpeechSynthesis local.
 *
 * En iPadOS el AudioContext arranca suspendido hasta que hay un gesto del
 * usuario; `unlock()` se llama desde el boton "Empezar", que es tambien el
 * gesto que habilita la camara.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume: Volume = 'HIGH';
  private voice: SpeechSynthesisVoice | null = null;
  private buffers = new Map<AudioCue, AudioBuffer>();

  get unlocked(): boolean {
    return this.context !== null && this.context.state === 'running';
  }

  setVolume(volume: Volume): void {
    this.volume = volume;
    if (this.master) this.master.gain.value = VOLUME_GAIN[volume];
    if (volume === 'MUTE') this.cancelSpeech();
  }

  /** Debe llamarse dentro de un gesto del usuario. */
  async unlock(): Promise<void> {
    if (!this.context) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = VOLUME_GAIN[this.volume];
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.pickVoice();
    // Safari solo permite hablar despues de un gesto: un enunciado vacio
    // "calienta" el motor de voz para que la cuenta regresiva no falle.
    this.primeSpeech();
    await this.preload();
  }

  /**
   * Precarga los recursos de audio. Los tonos se sintetizan a AudioBuffer una
   * sola vez, antes de la cuenta regresiva, para que no haya glitches.
   */
  async preload(): Promise<void> {
    if (!this.context) return;
    const cues = Object.keys(AUDIO_CUES) as AudioCue[];
    for (const cue of cues) {
      if (this.buffers.has(cue)) continue;
      const definition = AUDIO_CUES[cue];
      if (definition.file) {
        try {
          const response = await fetch(
            new URL(`audio/${definition.file}`, import.meta.env.BASE_URL).toString(),
          );
          const bytes = await response.arrayBuffer();
          this.buffers.set(cue, await this.context.decodeAudioData(bytes));
          continue;
        } catch {
          // Si el archivo local no esta, caemos al tono sintetizado.
        }
      }
      this.buffers.set(cue, this.renderTones(cue));
    }
  }

  play(cue: AudioCue): void {
    if (this.volume === 'MUTE') return;
    const definition = AUDIO_CUES[cue];
    this.playBuffer(cue);
    if (definition.speech) this.speak(definition.speech, definition.interrupt ?? false);
  }

  stopAll(): void {
    this.cancelSpeech();
  }

  dispose(): void {
    this.cancelSpeech();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.buffers.clear();
  }

  private playBuffer(cue: AudioCue): void {
    if (!this.context || !this.master) return;
    const buffer = this.buffers.get(cue) ?? this.renderTones(cue);
    this.buffers.set(cue, buffer);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master);
    source.start();
  }

  /** Sintetiza los tonos de una senal a un AudioBuffer reutilizable. */
  private renderTones(cue: AudioCue): AudioBuffer {
    const context = this.context!;
    const tones = AUDIO_CUES[cue].tones;
    const totalSeconds = tones.reduce((max, t) => Math.max(max, (t.at ?? 0) + t.duration), 0.1);
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.ceil(totalSeconds * sampleRate), sampleRate);
    const data = buffer.getChannelData(0);

    for (const tone of tones) {
      const start = Math.floor((tone.at ?? 0) * sampleRate);
      const length = Math.floor(tone.duration * sampleRate);
      const gain = tone.gain ?? 0.85;
      for (let i = 0; i < length; i += 1) {
        const t = i / sampleRate;
        const phase = 2 * Math.PI * tone.freq * t;
        let sample: number;
        switch (tone.type ?? 'sine') {
          case 'square':
            sample = Math.sign(Math.sin(phase));
            break;
          case 'triangle':
            sample = 2 * Math.abs(2 * ((tone.freq * t) % 1) - 1) - 1;
            break;
          case 'sawtooth':
            sample = 2 * ((tone.freq * t) % 1) - 1;
            break;
          default:
            sample = Math.sin(phase);
        }
        // Envolvente suave para que no suene a "click" en los extremos.
        const attack = Math.min(1, i / (0.01 * sampleRate));
        const release = Math.min(1, (length - i) / (0.02 * sampleRate));
        const index = start + i;
        if (index < data.length) data[index] += sample * gain * attack * release * 0.5;
      }
    }

    // Normalizacion simple por si dos tonos se solapan.
    let peak = 0;
    for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > 1) for (let i = 0; i < data.length; i += 1) data[i] /= peak;

    return buffer;
  }

  private pickVoice(): void {
    if (this.voice || typeof speechSynthesis === 'undefined') return;
    const voices = speechSynthesis.getVoices();
    this.voice =
      voices.find((v) => v.lang.toLowerCase().startsWith('es') && v.localService) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('es')) ??
      null;
  }

  private primeSpeech(): void {
    if (typeof speechSynthesis === 'undefined') return;
    // Algunas versiones de Safari pueblan getVoices() de forma asincrona.
    speechSynthesis.addEventListener?.('voiceschanged', () => {
      this.voice = null;
      this.pickVoice();
    });
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
    speechSynthesis.speak(warmup);
  }

  private speak(text: string, interrupt: boolean): void {
    if (typeof speechSynthesis === 'undefined') return;
    if (interrupt) speechSynthesis.cancel();
    this.pickVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.voice?.lang ?? 'es-ES';
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = 0.95;
    utterance.pitch = 1.15;
    utterance.volume = this.volume === 'LOW' ? 0.5 : 1;
    speechSynthesis.speak(utterance);
  }

  private cancelSpeech(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}
