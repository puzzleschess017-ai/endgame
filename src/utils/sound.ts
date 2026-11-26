/**
 * Sounds of the site, made with the Web Audio API (no audio files), in two styles: "pop"
 * (soft, round pops) and "electronic" (short blips).
 * Volume, mute and style are one setting for the whole site, saved in the browser, and read by
 * `useSoundSettings` for the sound menu.
 */

export type SoundType = 'move' | 'capture' | 'check' | 'error' | 'success';

export type SoundStyle = 'pop' | 'electronic';
export const SOUND_STYLES: readonly SoundStyle[] = ['pop', 'electronic'];

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
    // 'classic' was the name of an earlier wooden style that is gone; whoever chose it gets the pop style.
    const saved = (data?.style as string) === 'classic' ? 'pop' : data?.style;
    const style = SOUND_STYLES.includes(saved as SoundStyle) ? (saved as SoundStyle) : DEFAULT_SOUND_SETTINGS.style;
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
  master.gain.setValueAtTime(style === 'pop' ? level * POP_GAIN : level, when);
  master.connect(destination);
  if (style === 'pop') pops(ctx, master, type, when);
  else blip(ctx, master, type, when);
}

/** Gain of the "pop" style: its tones last longer than the blips, so they get less gain for the same loudness. */
const POP_GAIN = 0.1;

/** One soft pop: a sine that glides down an octave while it fades, plus a quiet second tone an octave up. */
function pop(ctx: BaseAudioContext, out: AudioNode, when: number, freq: number, amp: number): void {
  const tone = (f: number, dur: number, decay: number, a: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, when);
    osc.frequency.exponentialRampToValueAtTime(f * 0.5, when + decay);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(a, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(out);
    osc.start(when);
    osc.stop(when + dur + 0.01);
  };
  tone(freq, 0.25, 0.06, amp);
  tone(freq * 2, 0.1, 0.02, amp * 0.2);
}

function pops(ctx: BaseAudioContext, out: AudioNode, type: SoundType, now: number): void {
  if (type === 'move') {
    pop(ctx, out, now, 240, 1);
  } else if (type === 'capture') {
    pop(ctx, out, now, 252, 0.6);
    pop(ctx, out, now + 0.03, 180, 1.1);
  } else if (type === 'check') {
    pop(ctx, out, now, 240, 1);
    pop(ctx, out, now + 0.12, 450, 0.7);
  } else if (type === 'error') {
    pop(ctx, out, now, 130, 1);
  } else {
    pop(ctx, out, now, 300, 0.9);
    pop(ctx, out, now + 0.09, 400, 0.9);
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
