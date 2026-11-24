/**
 * Sounds of the site, made with the Web Audio API (no audio files): short electronic blips.
 * Volume and mute are one setting for the whole site, saved in the browser, and read by
 * `useSoundSettings` for the volume menu.
 */

export type SoundType = 'move' | 'capture' | 'check' | 'error' | 'success';

export interface SoundSettings {
  /** 0 (silent) to 1. */
  volume: number;
  muted: boolean;
}

export const SOUND_STORAGE_KEY = 'ctg_sound_v1';
export const DEFAULT_SOUND_SETTINGS: SoundSettings = { volume: 0.5, muted: false };

/** The volume slider's 50 % is the loudness the site always had; 100 % is twice that. */
const LOUDNESS_AT_FULL_VOLUME = 2;

export function parseSoundSettings(raw: string | null): SoundSettings {
  if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
  try {
    const data = JSON.parse(raw) as Partial<SoundSettings> | null;
    const volume =
      typeof data?.volume === 'number' && Number.isFinite(data.volume)
        ? Math.min(1, Math.max(0, data.volume))
        : DEFAULT_SOUND_SETTINGS.volume;
    // Settings saved earlier may also hold a sound style; it is ignored.
    return { volume, muted: data?.muted === true };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

/** Master gain for a slider volume of 0..1. */
export function volumeToGain(volume: number): number {
  const v = Math.min(1, Math.max(0, volume));
  return v * LOUDNESS_AT_FULL_VOLUME;
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
  scheduleSound(ctx, ctx.destination, type, ctx.currentTime, volumeToGain(settings.volume));
}

/** Plays one move sound for the volume menu so the chosen volume can be heard. Ignores mute. */
export function playSoundPreview(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const gain = volumeToGain(settings.volume > 0 ? settings.volume : DEFAULT_SOUND_SETTINGS.volume);
  scheduleSound(ctx, ctx.destination, 'capture', ctx.currentTime, gain);
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
): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(level, when);
  master.connect(destination);
  blip(ctx, master, type, when);
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
