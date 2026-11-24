// Who may use what. Three kinds of visitor:
//   guest   - not signed in ("Play as a guest")
//   free    - signed in, no premium
//   premium - signed in and paid (until payment exists, the tier is set by hand in the database)
// Board Editor, Endgame Tablebase, Puzzle Streak, Puzzle Race, Coordinate Training and Statistics are for
// everybody. The limits below are for Woodpecker and Blindfold. The same rules are used in the browser (to
// grey out choices) and on the server (to refuse a request that asks for more than the visitor may have).
import type { CycleCountOption, Difficulty, PuzzleCountOption, PuzzleMode, TrainingConfig } from '../types';
import type { BlindfoldLevel, MemorizeSeconds } from './blindfold';
import { DRILL_KINDS, type DrillKind } from './drills.ts';

export type Tier = 'guest' | 'free' | 'premium';
export const TIERS: Tier[] = ['guest', 'free', 'premium'];

export const ALL_CYCLES: CycleCountOption[] = [2, 3, 4, 5, 6, 7];
export const ALL_COUNTS: PuzzleCountOption[] = [10, 50, 100, 200];
export const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'mixed'];
export const ALL_TYPES: PuzzleMode[] = ['classic', 'endgame'];
export const ALL_LEVELS: BlindfoldLevel[] = [6, 7, 8, 10, 32];
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
  /** Which drills (square colours, diagonals, knight routes) may be played. */
  drills: DrillKind[];
}

export interface Access {
  woodpecker: WoodpeckerAccess;
  blindfold: BlindfoldAccess;
}

export const ACCESS: Record<Tier, Access> = {
  guest: {
    woodpecker: { cycles: [2, 3], counts: [10, 50], difficulties: ['easy', 'medium'], types: ['classic'] },
    blindfold: { levels: [], memorize: [], drills: [] },
  },
  free: {
    woodpecker: { cycles: [2, 3, 4], counts: [10, 50, 100], difficulties: ['easy', 'medium', 'hard'], types: ['classic'] },
    blindfold: { levels: [6, 7], memorize: [10], drills: ['color'] },
  },
  premium: {
    woodpecker: { cycles: ALL_CYCLES, counts: ALL_COUNTS, difficulties: ALL_DIFFICULTIES, types: ALL_TYPES },
    blindfold: { levels: ALL_LEVELS, memorize: ALL_MEMORIZE, drills: DRILL_KINDS },
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

/**
 * Checks a Woodpecker setup (the type counts as endgame when missing, like old saved sessions).
 * The number of cycles is optional: the server never sees it, so it only checks the rest.
 */
export function checkWoodpecker(
  tier: Tier,
  config: Pick<TrainingConfig, 'puzzleCount' | 'difficulty' | 'puzzleMode'> & { totalCycles?: CycleCountOption },
): Check {
  const allowed = ACCESS[tier].woodpecker;
  const type = config.puzzleMode ?? 'endgame';
  const checks: Array<[boolean, string, Tier | null]> = [
    [allowed.types.includes(type), `The ${type} puzzle type`, tierFor((a) => a.woodpecker.types, type)],
    [allowed.difficulties.includes(config.difficulty), `The ${config.difficulty} difficulty`, tierFor((a) => a.woodpecker.difficulties, config.difficulty)],
    [allowed.counts.includes(config.puzzleCount), `${config.puzzleCount} puzzles per cycle`, tierFor((a) => a.woodpecker.counts, config.puzzleCount)],
  ];
  const cycles = config.totalCycles;
  if (cycles !== undefined) {
    checks.push([allowed.cycles.includes(cycles), `${cycles} cycles`, tierFor((a) => a.woodpecker.cycles, cycles)]);
  }
  for (const [ok, name, needs] of checks) if (!ok) return refuse(name, needs);
  return { ok: true };
}

/** Checks how many pieces a Blindfold "mate in 1" round may have (the server can check this one). */
export function checkBlindfoldLevel(tier: Tier, level: BlindfoldLevel): Check {
  return ACCESS[tier].blindfold.levels.includes(level)
    ? { ok: true }
    : refuse(level === 32 ? 'Any number of pieces' : `Up to ${level} pieces`, tierFor((a) => a.blindfold.levels, level));
}

/** Checks a Blindfold "mate in 1" round: how many pieces at most, and how long the position is shown. */
export function checkBlindfoldMate(tier: Tier, settings: { level: BlindfoldLevel; memorize: MemorizeSeconds }): Check {
  const level = checkBlindfoldLevel(tier, settings.level);
  if (!level.ok) return level;
  if (!ACCESS[tier].blindfold.memorize.includes(settings.memorize)) {
    return refuse(`${settings.memorize} seconds to memorize`, tierFor((a) => a.blindfold.memorize, settings.memorize));
  }
  return { ok: true };
}

/** The nearest settings the tier may use: the largest allowed level not above the wanted one, the closest memorize time. */
export function clampBlindfold(tier: Tier, settings: { level: BlindfoldLevel; memorize: MemorizeSeconds }): { level: BlindfoldLevel; memorize: MemorizeSeconds } {
  const { levels, memorize } = ACCESS[tier].blindfold;
  if (levels.length === 0 || memorize.length === 0) return settings;
  const level = levels.includes(settings.level)
    ? settings.level
    : [...levels].sort((a, b) => a - b).filter((l) => l <= settings.level).pop() ?? levels[0];
  const time = memorize.includes(settings.memorize)
    ? settings.memorize
    : [...memorize].sort((a, b) => Math.abs(a - settings.memorize) - Math.abs(b - settings.memorize))[0];
  return { level, memorize: time };
}

/** The drill to show: the wanted one when allowed, else the first allowed one (or the wanted one when none is). */
export function clampDrill(tier: Tier, kind: DrillKind): DrillKind {
  const { drills } = ACCESS[tier].blindfold;
  return drills.length === 0 || drills.includes(kind) ? kind : drills[0];
}

const DRILL_NAME: Record<DrillKind, string> = { color: 'Square colours', diagonal: 'Diagonals', knight: 'Knight routes' };

export function checkBlindfoldDrill(tier: Tier, kind: DrillKind): Check {
  return ACCESS[tier].blindfold.drills.includes(kind)
    ? { ok: true }
    : refuse(DRILL_NAME[kind], tierFor((a) => a.blindfold.drills, kind));
}

/** True when the tier may open Blindfold at all (some mode of it). */
export function canOpenBlindfold(tier: Tier): boolean {
  const a = ACCESS[tier].blindfold;
  return a.levels.length > 0 || a.drills.length > 0;
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
