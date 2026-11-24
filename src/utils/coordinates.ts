// Pure helpers for the coordinates trainer (no React, no DOM except localStorage).

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export type CoordinateMode = 'find' | 'name';
export type CoordinateDuration = 30 | 60;
export type CoordinateOrientation = 'white' | 'black' | 'random';

export interface CoordinateSettings {
  mode: CoordinateMode;
  duration: CoordinateDuration;
  orientation: CoordinateOrientation;
  showLabels: boolean;
}

export const DEFAULT_COORDINATE_SETTINGS: CoordinateSettings = {
  mode: 'find',
  duration: 30,
  orientation: 'white',
  showLabels: false,
};

export const SETTINGS_STORAGE_KEY = 'ctg_coordinates_settings_v1';
export const BEST_STORAGE_KEY = 'ctg_coordinates_best_v1';

export function isSquare(value: string): boolean {
  return /^[a-h][1-8]$/.test(value);
}

/** a1 is a dark square: file index + rank index is even. */
export function isDarkSquare(square: string): boolean {
  const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const rank = RANKS.indexOf(square[1] as (typeof RANKS)[number]);
  return (file + rank) % 2 === 0;
}

/** Random square, never equal to `previous` so the same target does not repeat. */
export function randomSquare(previous?: string | null, rng: () => number = Math.random): string {
  for (;;) {
    const square = `${FILES[Math.floor(rng() * 8)]}${RANKS[Math.floor(rng() * 8)]}`;
    if (square !== previous) return square;
  }
}

export function accuracyPercent(correct: number, misses: number): number {
  const total = correct + misses;
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function bestKey(mode: CoordinateMode, duration: CoordinateDuration): string {
  return `${mode}_${duration}`;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadCoordinateSettings(): CoordinateSettings {
  const parsed = readJson(SETTINGS_STORAGE_KEY) as Partial<CoordinateSettings> | null;
  const d = DEFAULT_COORDINATE_SETTINGS;
  if (!parsed || typeof parsed !== 'object') return { ...d };
  return {
    mode: parsed.mode === 'name' || parsed.mode === 'find' ? parsed.mode : d.mode,
    duration: parsed.duration === 60 || parsed.duration === 30 ? parsed.duration : d.duration,
    orientation:
      parsed.orientation === 'white' || parsed.orientation === 'black' || parsed.orientation === 'random'
        ? parsed.orientation
        : d.orientation,
    showLabels: typeof parsed.showLabels === 'boolean' ? parsed.showLabels : d.showLabels,
  };
}

export function saveCoordinateSettings(settings: CoordinateSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode, quota): the trainer still works
  }
}

export function loadBestScore(mode: CoordinateMode, duration: CoordinateDuration): number {
  const parsed = readJson(BEST_STORAGE_KEY) as Record<string, unknown> | null;
  const value = parsed && typeof parsed === 'object' ? parsed[bestKey(mode, duration)] : 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Stores `score` if it beats the saved best. A score of 0 never counts as a record. */
export function saveBestScore(
  mode: CoordinateMode,
  duration: CoordinateDuration,
  score: number,
): { best: number; isNewBest: boolean } {
  const previous = loadBestScore(mode, duration);
  if (score <= 0 || score <= previous) return { best: previous, isNewBest: false };
  try {
    const parsed = readJson(BEST_STORAGE_KEY);
    const all = parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
    all[bestKey(mode, duration)] = score;
    localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return { best: score, isNewBest: true };
}
