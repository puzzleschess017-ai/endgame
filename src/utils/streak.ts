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
