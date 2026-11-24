/**
 * Sounds of the site, made with the Web Audio API (no audio files).
 *
 * Two styles: "robotic" (short electronic blips, the original sound) and "classic" (a chess piece
 * set down on a wooden board). Volume, style and mute are one setting for the whole site, saved in
 * the browser, and read by `useSoundSettings` for the volume menu.
 */

export type SoundType = 'move' | 'capture' | 'check' | 'error' | 'success';
export type SoundStyle = 'robotic' | 'classic';

export const SOUND_STYLES: Array<{ id: SoundStyle; name: string; hint: string }> = [
  { id: 'robotic', name: 'Robotic', hint: 'Short electronic blips' },
  { id: 'classic', name: 'Classic', hint: 'Pieces on a wooden board' },
];

export interface SoundSettings {
  /** 0 (silent) to 1. */
  volume: number;
  style: SoundStyle;
  muted: boolean;
}

export const SOUND_STORAGE_KEY = 'ctg_sound_v1';
export const DEFAULT_SOUND_SETTINGS: SoundSettings = { volume: 0.5, style: 'robotic', muted: false };

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
    const style: SoundStyle = data?.style === 'classic' ? 'classic' : 'robotic';
    return { volume, style, muted: data?.muted === true };
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
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

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
  scheduleSound(ctx, ctx.destination, type, settings.style, ctx.currentTime, volumeToGain(settings.volume));
}

/** Plays one move sound for the volume menu so the choice can be heard. Ignores mute. */
export function playSoundPreview(style: SoundStyle): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const gain = volumeToGain(settings.volume > 0 ? settings.volume : DEFAULT_SOUND_SETTINGS.volume);
  scheduleSound(ctx, ctx.destination, 'capture', style, ctx.currentTime, gain);
}

/**
 * Schedules a sound on any audio context (also an OfflineAudioContext, which is how it is tested).
 * `level` multiplies the loudness of the whole sound.
 */
export function scheduleSound(
  ctx: BaseAudioContext,
  destination: AudioNode,
  type: SoundType,
  style: SoundStyle,
  when: number,
  level: number,
): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(level, when);
  master.connect(destination);
  if (style === 'classic') classicSound(ctx, master, type, when);
  else roboticSound(ctx, master, type, when);
}

function roboticSound(ctx: BaseAudioContext, out: AudioNode, type: SoundType, now: number): void {
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

// ----- Classic: a piece set down on a wooden board ---------------------------------------------

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.25)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // A fixed pseudo-random sequence, so the same sound is made every time on every device.
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 0xffffffff) * 2 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

interface TapOptions {
  /** Start time in seconds. */
  at: number;
  /** Loudness of the whole tap. */
  gain: number;
  /** Pitch of the wooden "body" of the tap (Hz). Lower = a heavier piece. */
  body: number;
  /** How long the body rings (s). */
  ring: number;
  /** Centre of the sharp "click" of the contact (Hz). */
  click: number;
  /** Loudness of the click compared with the body. */
  clickAmount: number;
}

/** One knock of wood on wood: a short filtered noise click on top of a quickly fading hollow tone. */
function woodTap(ctx: BaseAudioContext, out: AudioNode, o: TapOptions): void {
  const { at } = o;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(o.click, at);
  band.Q.setValueAtTime(0.9, at);
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.0001, at);
  clickGain.gain.linearRampToValueAtTime(o.gain * o.clickAmount, at + 0.001);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
  noise.connect(band);
  band.connect(clickGain);
  clickGain.connect(out);
  noise.start(at);
  noise.stop(at + 0.04);

  // The hollow wooden body: a sine that drops in pitch, and a softer overtone above it.
  const partials: Array<[number, number, number]> = [
    [1, 1, 1],
    [2.05, 0.35, 0.6],
  ];
  for (const [ratio, amount, length] of partials) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(o.body * ratio * 1.25, at);
    osc.frequency.exponentialRampToValueAtTime(o.body * ratio, at + 0.03);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(o.gain * amount, at + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, at + o.ring * length);
    osc.connect(env);
    env.connect(out);
    osc.start(at);
    osc.stop(at + o.ring * length + 0.01);
  }
}

/** A short pure tone with a woody attack, for the check and success sounds. */
function woodTone(ctx: BaseAudioContext, out: AudioNode, at: number, freq: number, gain: number, ring: number): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, at + ring);
  osc.connect(env);
  env.connect(out);
  osc.start(at);
  osc.stop(at + ring + 0.01);
}

/** Wood knocks are sharp and loud for their size; this brings them to the loudness of the robotic set. */
const CLASSIC_LEVEL = 0.2;

function classicSound(ctx: BaseAudioContext, destination: AudioNode, type: SoundType, now: number): void {
  const out = ctx.createGain();
  out.gain.setValueAtTime(CLASSIC_LEVEL, now);
  out.connect(destination);

  if (type === 'move') {
    woodTap(ctx, out, { at: now, gain: 0.5, body: 250, ring: 0.075, click: 2400, clickAmount: 1.1 });
  } else if (type === 'capture') {
    // A heavier knock, then the captured piece being lifted off a moment later.
    woodTap(ctx, out, { at: now, gain: 0.65, body: 200, ring: 0.1, click: 1800, clickAmount: 1.2 });
    woodTap(ctx, out, { at: now + 0.045, gain: 0.3, body: 300, ring: 0.05, click: 2800, clickAmount: 1 });
  } else if (type === 'check') {
    woodTap(ctx, out, { at: now, gain: 0.5, body: 230, ring: 0.085, click: 2200, clickAmount: 1.1 });
    woodTone(ctx, out, now + 0.08, 1320, 0.3, 0.16);
  } else if (type === 'error') {
    // A dull, muffled thud.
    woodTap(ctx, out, { at: now, gain: 0.55, body: 120, ring: 0.16, click: 600, clickAmount: 0.7 });
  } else {
    // Two rising wood-block notes.
    woodTap(ctx, out, { at: now, gain: 0.3, body: 300, ring: 0.05, click: 2500, clickAmount: 0.9 });
    woodTone(ctx, out, now, 784, 0.34, 0.14);
    woodTone(ctx, out, now + 0.085, 1175, 0.34, 0.2);
  }
}
