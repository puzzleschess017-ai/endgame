/**
 * Sounds of the site, made with the Web Audio API (no audio files), in two styles: "classic"
 * (a wooden piece on a wooden board) and "electronic" (short blips).
 * Volume, mute and style are one setting for the whole site, saved in the browser, and read by
 * `useSoundSettings` for the sound menu.
 */

export type SoundType = 'move' | 'capture' | 'check' | 'error' | 'success';

export type SoundStyle = 'classic' | 'electronic';
export const SOUND_STYLES: readonly SoundStyle[] = ['classic', 'electronic'];

export interface SoundSettings {
  /** 0 (silent) to 1. */
  volume: number;
  muted: boolean;
  style: SoundStyle;
}

export const SOUND_STORAGE_KEY = 'ctg_sound_v1';
export const DEFAULT_SOUND_SETTINGS: SoundSettings = { volume: 0.5, muted: false, style: 'electronic' };

/** The volume slider's 50 % is the loudness the site always had; 100 % is four times that (the curve is quadratic). */
const LOUDNESS_AT_FULL_VOLUME = 4;

export function parseSoundSettings(raw: string | null): SoundSettings {
  if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const data = JSON.parse(raw) as Partial<SoundSettings> | null;
    const volume =
      typeof data?.volume === 'number' && Number.isFinite(data.volume)
        ? Math.min(1, Math.max(0, data.volume))
        : DEFAULT_SOUND_SETTINGS.volume;
    const style = SOUND_STYLES.includes(data?.style as SoundStyle) ? (data?.style as SoundStyle) : DEFAULT_SOUND_SETTINGS.style;
    return { volume, muted: data?.muted === true, style };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

/** Master gain for a slider volume of 0..1. */
export function volumeToGain(volume: number): number {
  const v = Math.min(1, Math.max(0, volume));
  return v * v * LOUDNESS_AT_FULL_VOLUME;
}

/** True when nothing would be heard. */
export function isSilent(settings: SoundSettings): boolean {
  return settings.muted || settings.volume <= 0;
}

let settings: SoundSettings = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): SoundSettings {
  try {
    return parseSoundSettings(typeof localStorage === 'undefined' ? null : localStorage.getItem(SOUND_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

export function getSoundSettings(): SoundSettings {
  return settings;
}

export function setSoundSettings(patch: Partial<SoundSettings>): void {
  settings = parseSoundSettings(JSON.stringify({ ...settings, ...patch }));
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: the setting still works until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSoundSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------------------------
// Playing

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Plays a sound in the saved style and volume, unless the site is muted. */
export function playMoveSound(type: SoundType): void {
  if (isSilent(settings)) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  scheduleSound(ctx, ctx.destination, type, ctx.currentTime, volumeToGain(settings.volume), settings.style);
}

/** Plays one move sound for the volume menu so the chosen volume can be heard. Ignores mute. */
export function playSoundPreview(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const gain = volumeToGain(settings.volume > 0 ? settings.volume : DEFAULT_SOUND_SETTINGS.volume);
  scheduleSound(ctx, ctx.destination, 'move', ctx.currentTime, gain, settings.style);
}

/**
 * Schedules a sound on any audio context (also an OfflineAudioContext, which is how it is tested).
 * `level` multiplies the loudness of the whole sound.
 */
export function scheduleSound(
  ctx: BaseAudioContext,
  destination: AudioNode,
  type: SoundType,
  when: number,
  level: number,
  style: SoundStyle = 'electronic',
): void {
  const master = ctx.createGain();
  // The wooden knocks are sharper than the blips, so they get a little less gain to stay below clipping at 100 %.
  master.gain.setValueAtTime(style === 'classic' ? level * CLASSIC_GAIN : level, when);
  master.connect(destination);
  if (style === 'classic') wood(ctx, master, type, when);
  else blip(ctx, master, type, when);
}

const CLASSIC_GAIN = 0.8;

let noiseBuffer: AudioBuffer | null = null;
let noiseBufferRate = 0;

/** 0.15 s of white noise, the "click" of a piece landing. */
function getNoise(ctx: BaseAudioContext): AudioBuffer {
  if (!noiseBuffer || noiseBufferRate !== ctx.sampleRate) {
    const length = Math.ceil(ctx.sampleRate * 0.15);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 12345; // fixed noise, so the sound is always the same
    for (let i = 0; i < length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 0x7fffffff) - 1;
    }
    noiseBuffer = buffer;
    noiseBufferRate = ctx.sampleRate;
  }
  return noiseBuffer;
}

/** One wooden knock: a burst of noise through a band filter plus a short low body tone. */
function knock(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  o: { peak: number; band: number; q: number; decay: number; body: number; bodyPeak: number },
): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(o.band, when);
  filter.Q.setValueAtTime(o.q, when);
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.peak, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + o.decay);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(when);
  src.stop(when + o.decay + 0.02);

  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(o.body, when);
  osc.frequency.exponentialRampToValueAtTime(o.body * 0.55, when + o.decay * 1.3);
  og.gain.setValueAtTime(o.bodyPeak, when);
  og.gain.exponentialRampToValueAtTime(0.001, when + o.decay * 1.3);
  osc.connect(og);
  og.connect(out);
  osc.start(when);
  osc.stop(when + o.decay * 1.3 + 0.02);
}

/** The classic board: a wooden piece set down on a wooden board. */
function wood(ctx: BaseAudioContext, out: AudioNode, type: SoundType, now: number): void {
  if (type === 'move') {
    knock(ctx, out, now, { peak: 0.5, band: 1100, q: 2.2, decay: 0.05, body: 210, bodyPeak: 0.12 });
  } else if (type === 'capture') {
    // the captured piece is knocked aside, then the capturing piece lands harder
    knock(ctx, out, now, { peak: 0.35, band: 1700, q: 2, decay: 0.035, body: 280, bodyPeak: 0.06 });
    knock(ctx, out, now + 0.028, { peak: 0.7, band: 950, q: 1.8, decay: 0.07, body: 170, bodyPeak: 0.16 });
  } else if (type === 'check') {
    knock(ctx, out, now, { peak: 0.55, band: 1100, q: 2.2, decay: 0.05, body: 210, bodyPeak: 0.12 });
    knock(ctx, out, now + 0.11, { peak: 0.4, band: 2000, q: 3, decay: 0.045, body: 420, bodyPeak: 0.07 });
  } else if (type === 'error') {
    knock(ctx, out, now, { peak: 0.5, band: 420, q: 1.4, decay: 0.12, body: 120, bodyPeak: 0.22 });
  } else {
    knock(ctx, out, now, { peak: 0.4, band: 1500, q: 3, decay: 0.05, body: 523, bodyPeak: 0.1 });
    knock(ctx, out, now + 0.08, { peak: 0.45, band: 1900, q: 3, decay: 0.06, body: 659, bodyPeak: 0.1 });
  }
}

function blip(ctx: BaseAudioContext, out: AudioNode, type: SoundType, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(out);

  if (type === 'move') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.055);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.065);
  } else if (type === 'capture') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.075);
    gain.gain.setValueAtTime(0.095, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.085);
  } else if (type === 'check') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.11);
    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.125);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.linearRampToValueAtTime(135, now + 0.14);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.start(now);
    osc.stop(now + 0.17);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.07);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.23);
  }
}
