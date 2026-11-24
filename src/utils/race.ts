// Pure helpers for Puzzle Race (no React): rules, ladder settings, saved settings and best scores.

export type RaceDuration = 60 | 180 | 300;

export const RACE_DURATIONS: RaceDuration[] = [60, 180, 300];

/** A wrong move takes this much time off the clock. */
export const WRONG_MOVE_PENALTY_MS = 10_000;

/** Race starts easy and gets about 25 rating points harder with every puzzle. */
export const RACE_LADDER = { start: 500, step: 25, batchSize: 30 } as const;

export interface RaceSettings {
  duration: RaceDuration;
}

export const DEFAULT_RACE_SETTINGS: RaceSettings = { duration: 180 };

export const RACE_SETTINGS_STORAGE_KEY = 'ctg_race_settings_v1';
export const RACE_BEST_STORAGE_KEY = 'ctg_race_best_v1';

export function isRaceDuration(value: unknown): value is RaceDuration {
  return value === 60 || value === 180 || value === 300;
}

/** "1 min", "3 min", "5 min". */
export function durationLabel(duration: RaceDuration): string {
  return `${duration / 60} min`;
}

/** Remaining time as m:ss, rounded up so the clock reads 0:00 only when time is really over. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function raceAccuracy(solved: number, wrong: number): number {
  const total = solved + wrong;
  return total === 0 ? 0 : Math.round((solved / total) * 100);
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadRaceSettings(): RaceSettings {
  const parsed = readJson(RACE_SETTINGS_STORAGE_KEY) as Partial<RaceSettings> | null;
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_RACE_SETTINGS };
  return {
    duration: isRaceDuration(parsed.duration) ? parsed.duration : DEFAULT_RACE_SETTINGS.duration,
  };
}

export function saveRaceSettings(settings: RaceSettings): void {
  try {
    localStorage.setItem(RACE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode, quota): the race still works
  }
}

export function loadRaceBest(duration: RaceDuration): number {
  const parsed = readJson(RACE_BEST_STORAGE_KEY) as Record<string, unknown> | null;
  const value = parsed && typeof parsed === 'object' ? parsed[String(duration)] : 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Stores `solved` if it beats the saved best for this length. 0 never counts as a record. */
export function saveRaceBest(
  duration: RaceDuration,
  solved: number,
): { best: number; isNewBest: boolean } {
  const previous = loadRaceBest(duration);
  if (solved <= 0 || solved <= previous) return { best: previous, isNewBest: false };
  try {
    const parsed = readJson(RACE_BEST_STORAGE_KEY);
    const all = parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
    all[String(duration)] = Math.floor(solved);
    localStorage.setItem(RACE_BEST_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return { best: Math.floor(solved), isNewBest: true };
}
