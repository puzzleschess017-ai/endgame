// Pure helpers for Puzzle Survival (no React): rules, ladder settings and the saved best score.
// Survival has no clock: you may get three puzzles wrong, the third mistake ends the run, and the score is how many
// puzzles you solved before that. The puzzles start easy and get harder one by one.

/** The run ends with this mistake. */
export const SURVIVAL_STRIKES = 3;

/** Survival starts easy (about 500) and gets about 25 rating points harder with every puzzle. */
export const SURVIVAL_LADDER = { start: 500, step: 25, batchSize: 30 } as const;

export const SURVIVAL_BEST_STORAGE_KEY = 'ctg_survival_best_v1';

/** Strikes left after `wrong` mistakes (never below 0). */
export function strikesLeft(wrong: number): number {
  return Math.max(0, SURVIVAL_STRIKES - Math.max(0, Math.floor(wrong)));
}

export function survivalAccuracy(solved: number, wrong: number): number {
  const total = solved + wrong;
  return total === 0 ? 0 : Math.round((solved / total) * 100);
}

export function loadSurvivalBest(): number {
  try {
    const value = Number(localStorage.getItem(SURVIVAL_BEST_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/** Stores `solved` if it beats the saved best. A score of 0 never counts as a record. */
export function saveSurvivalBest(solved: number): { best: number; isNewBest: boolean } {
  const previous = loadSurvivalBest();
  if (solved <= 0 || solved <= previous) return { best: previous, isNewBest: false };
  try {
    localStorage.setItem(SURVIVAL_BEST_STORAGE_KEY, String(Math.floor(solved)));
  } catch {
    // storage unavailable (private mode, quota): the run still counts for this visit
  }
  return { best: Math.floor(solved), isNewBest: true };
}
