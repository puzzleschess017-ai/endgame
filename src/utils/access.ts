// Who may use what. Three kinds of visitor:
//   guest   - not signed in ("Play as a guest")
//   free    - signed in, no premium
//   premium - signed in and paid (until payment exists, the tier is set by hand in the database)
// Board Editor, Endgame Tablebase, Puzzle Streak, Puzzle Race, Coordinate Training and Statistics are for
// everybody. The limits below are for Woodpecker and Blindfold. The same rules are used in the browser (to
// grey out choices) and on the server (to refuse a request that asks for more than the visitor may have).
import type { CycleCountOption, Difficulty, PuzzleCountOption, PuzzleMode, TrainingConfig } from '../types';
import type { BlindfoldLevel, MemorizeSeconds } from './blindfold';

export type Tier = 'guest' | 'free' | 'premium';
export const TIERS: Tier[] = ['guest', 'free', 'premium'];

export const ALL_CYCLES: CycleCountOption[] = [2, 3, 4, 5, 6, 7];
export const ALL_COUNTS: PuzzleCountOption[] = [10, 50, 100, 200];
export const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'mixed'];
export const ALL_TYPES: PuzzleMode[] = ['classic', 'endgame'];
export const ALL_LEVELS: BlindfoldLevel[] = [6, 8, 10, 32];
export const ALL_MEMORIZE: MemorizeSeconds[] = [5, 10, 20];

export interface WoodpeckerAccess {
  cycles: CycleCountOption[];
  counts: PuzzleCountOption[];
  difficulties: Difficulty[];
  types: PuzzleMode[];
}

export interface BlindfoldAccess {
  /** Mate in 1: the piece limits and memorize times allowed. Empty: the mode is closed. */
  levels: BlindfoldLevel[];
  memorize: MemorizeSeconds[];
  /** Square colours, diagonals and knight routes. */
  drills: boolean;
}

export interface Access {
  woodpecker: WoodpeckerAccess;
  blindfold: BlindfoldAccess;
}

export const ACCESS: Record<Tier, Access> = {
  guest: {
    woodpecker: { cycles: [2, 3], counts: [10, 50], difficulties: ['easy', 'medium'], types: ['classic'] },
    blindfold: { levels: [], memorize: [], drills: false },
  },
  free: {
    woodpecker: { cycles: [2, 3, 4], counts: [10, 50, 100], difficulties: ['easy', 'medium', 'hard'], types: ['classic'] },
    blindfold: { levels: [6], memorize: [5, 10], drills: false },
  },
  premium: {
    woodpecker: { cycles: ALL_CYCLES, counts: ALL_COUNTS, difficulties: ALL_DIFFICULTIES, types: ALL_TYPES },
    blindfold: { levels: ALL_LEVELS, memorize: ALL_MEMORIZE, drills: true },
  },
};

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as string[]).includes(value);
}

/** The lowest tier that has `value` in the list chosen by `pick`, or null when nobody has it. */
export function tierFor<T>(pick: (access: Access) => T[], value: T): Tier | null {
  return TIERS.find((tier) => pick(ACCESS[tier]).includes(value)) ?? null;
}

export const TIER_NAME: Record<Tier, string> = { guest: 'guest', free: 'a signed-in account', premium: 'Premium' };

/** What the person must do to get a choice: sign in, or go Premium. Empty when they already have it. */
export function unlockHint(tier: Tier, needed: Tier | null): string {
  if (needed === null || TIERS.indexOf(needed) <= TIERS.indexOf(tier)) return '';
  return needed === 'free' ? 'Sign in to unlock' : 'Premium';
}

export type Check = { ok: true } | { ok: false; reason: string; needs: Tier };

function refuse(name: string, needs: Tier | null): Check {
  return { ok: false, reason: `${name} is not available to you yet.`, needs: needs ?? 'premium' };
}

/** Checks a whole Woodpecker setup (the type counts as classic when missing, like old saved sessions). */
export function checkWoodpecker(tier: Tier, config: Pick<TrainingConfig, 'puzzleCount' | 'totalCycles' | 'difficulty' | 'puzzleMode'>): Check {
  const allowed = ACCESS[tier].woodpecker;
  const type = config.puzzleMode ?? 'endgame';
  const checks: Array<[boolean, string, Tier | null]> = [
    [allowed.types.includes(type), `The ${type} puzzle type`, tierFor((a) => a.woodpecker.types, type)],
    [allowed.difficulties.includes(config.difficulty), `The ${config.difficulty} difficulty`, tierFor((a) => a.woodpecker.difficulties, config.difficulty)],
    [allowed.counts.includes(config.puzzleCount), `${config.puzzleCount} puzzles per cycle`, tierFor((a) => a.woodpecker.counts, config.puzzleCount)],
    [allowed.cycles.includes(config.totalCycles), `${config.totalCycles} cycles`, tierFor((a) => a.woodpecker.cycles, config.totalCycles)],
  ];
  for (const [ok, name, needs] of checks) if (!ok) return refuse(name, needs);
  return { ok: true };
}

/** Checks a Blindfold "mate in 1" round: how many pieces at most, and how long the position is shown. */
export function checkBlindfoldMate(tier: Tier, settings: { level: BlindfoldLevel; memorize: MemorizeSeconds }): Check {
  const allowed = ACCESS[tier].blindfold;
  if (!allowed.levels.includes(settings.level)) {
    return refuse(settings.level === 32 ? 'Any number of pieces' : `Up to ${settings.level} pieces`, tierFor((a) => a.blindfold.levels, settings.level));
  }
  if (!allowed.memorize.includes(settings.memorize)) {
    return refuse(`${settings.memorize} seconds to memorize`, tierFor((a) => a.blindfold.memorize, settings.memorize));
  }
  return { ok: true };
}

export function checkBlindfoldDrills(tier: Tier): Check {
  return ACCESS[tier].blindfold.drills ? { ok: true } : refuse('Blindfold drills', 'premium');
}

/** True when the tier may open Blindfold at all (some mode of it). */
export function canOpenBlindfold(tier: Tier): boolean {
  const a = ACCESS[tier].blindfold;
  return a.levels.length > 0 || a.drills;
}

/** The first Woodpecker setup the tier is allowed to have, close to the usual one. */
export function defaultWoodpecker(tier: Tier): TrainingConfig {
  const a = ACCESS[tier].woodpecker;
  const pick = <T>(list: T[], preferred: T): T => (list.includes(preferred) ? preferred : list[list.length - 1]);
  return {
    puzzleCount: pick(a.counts, 50),
    totalCycles: pick(a.cycles, 4),
    difficulty: pick(a.difficulties, 'medium'),
    puzzleMode: a.types.includes('endgame') ? 'endgame' : 'classic',
  };
}
