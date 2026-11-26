import type { Puzzle } from '../types';

// Pure helpers for Puzzle Streak (no React): rules, ladder settings and the saved best streak.

export const STREAK_BEST_STORAGE_KEY = 'ctg_streak_best_v1';

/** Streak starts easy (about 500) and gets about 40 rating points harder with every puzzle. */
export const STREAK_LADDER = { start: 500, step: 40, batchSize: 30 } as const;

/** One puzzle may be skipped per run. */
export const STREAK_SKIPS_ALLOWED = 1;

export function loadBestStreak(): number {
  try {
    const value = Number(localStorage.getItem(STREAK_BEST_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/** Stores `streak` if it beats the saved best. A streak of 0 never counts as a record. */
export function saveBestStreak(streak: number): { best: number; isNewBest: boolean } {
  const previous = loadBestStreak();
  if (streak <= 0 || streak <= previous) return { best: previous, isNewBest: false };
  try {
    localStorage.setItem(STREAK_BEST_STORAGE_KEY, String(Math.floor(streak)));
  } catch {
    // storage unavailable (private mode, quota): the run still counts for this visit
  }
  return { best: Math.floor(streak), isNewBest: true };
}

// A run that is still going (no wrong move yet) survives leaving the page and coming back.
export const STREAK_RUN_STORAGE_KEY = 'ctg_streak_run_v1';
/** A saved run older than this is dropped, so nobody comes back to a stale puzzle weeks later. */
export const STREAK_RUN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SavedStreakRun {
  streak: number;
  skipsLeft: number;
  /** How many puzzles of the ladder were handed out (solved, skipped and the current one). */
  rung: number;
  /** The puzzle on the board, or null between two puzzles. */
  puzzle: Puzzle | null;
  /** Time actually spent in this run so far. */
  activeMs: number;
  savedAt: number;
}

export function saveStreakRun(run: Omit<SavedStreakRun, 'savedAt'>, now = Date.now()): void {
  try {
    localStorage.setItem(STREAK_RUN_STORAGE_KEY, JSON.stringify({ ...run, savedAt: now }));
  } catch {
    // storage unavailable: the run just does not survive leaving the page
  }
}

export function clearStreakRun(): void {
  try {
    localStorage.removeItem(STREAK_RUN_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

function isPuzzle(value: unknown): value is Puzzle {
  const p = value as Puzzle | null;
  return (
    !!p &&
    typeof p.puzzleId === 'string' &&
    typeof p.fen === 'string' &&
    Array.isArray(p.moves) &&
    p.moves.length >= 2 &&
    p.moves.every((m) => typeof m === 'string')
  );
}

/** The saved run, or null when there is none, it is too old or it is damaged. */
export function loadStreakRun(now = Date.now()): SavedStreakRun | null {
  try {
    const raw = localStorage.getItem(STREAK_RUN_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedStreakRun>;
    const whole = (n: unknown, min: number) => typeof n === 'number' && Number.isInteger(n) && n >= min;
    if (!whole(v.streak, 0) || !whole(v.skipsLeft, 0) || !whole(v.rung, 0)) return null;
    if (typeof v.activeMs !== 'number' || !Number.isFinite(v.activeMs) || v.activeMs < 0) return null;
    if (typeof v.savedAt !== 'number' || now - v.savedAt > STREAK_RUN_MAX_AGE_MS) return null;
    if (v.puzzle != null && !isPuzzle(v.puzzle)) return null;
    return {
      streak: v.streak as number,
      skipsLeft: Math.min(v.skipsLeft as number, STREAK_SKIPS_ALLOWED),
      rung: v.rung as number,
      puzzle: (v.puzzle as Puzzle | null) ?? null,
      activeMs: v.activeMs,
      savedAt: v.savedAt,
    };
  } catch {
    return null;
  }
}

export const STREAK_BEST_SEEN_KEY = 'ctg_streak_best_seen_v1';

/** The Best Puzzle Streak tile lights up once for every new best value, the first time it is shown. */
export function bestStreakGlowDue(best: number, seen: number | null): boolean {
  return best > 0 && best !== seen;
}

export function loadBestStreakSeen(): number | null {
  try {
    const raw = localStorage.getItem(STREAK_BEST_SEEN_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveBestStreakSeen(best: number): void {
  try {
    localStorage.setItem(STREAK_BEST_SEEN_KEY, String(best));
  } catch {
    // storage blocked: the glow may play again on the next visit
  }
}
