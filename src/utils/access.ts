// Who may use what. Three kinds of visitor:
//   guest   - not signed in ("Play as a guest")
//   free    - signed in, no premium
//   premium - signed in and paid (until payment exists, the tier is set by hand in the database)
// Board Editor, Board Analysis, Puzzle Streak, Puzzle Race, Coordinate Training and Statistics are for
// everybody, except that "Check with engine" in Board Analysis needs an account (ENGINE_TIER). The limits
// below are for Woodpecker and Blindfold. The same rules are used in the browser (to
// grey out choices) and on the server (to refuse a request that asks for more than the visitor may have).
import type { CycleCountOption, Difficulty, PuzzleCountOption, PuzzleMode, TrainingConfig } from '../types';
import type { BlindfoldLevel, MateIn, MemorizeSeconds } from './blindfold';
import { DRILL_KINDS, DRILL_LIMITS, drillLimitLabel, type DrillKind, type DrillLimit } from './drills.ts';

export type Tier = 'guest' | 'free' | 'premium';
export const TIERS: Tier[] = ['guest', 'free', 'premium'];

export const ALL_CYCLES: CycleCountOption[] = [2, 3, 4, 5, 6, 7, 8, 9];
export const ALL_COUNTS: PuzzleCountOption[] = [10, 50, 100, 200, 300, 500];
export const ALL_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'mixed'];
export const ALL_TYPES: PuzzleMode[] = ['classic', 'endgame'];
export const ALL_LEVELS: BlindfoldLevel[] = [6, 7, 8, 10, 32];
export const ALL_MEMORIZE: MemorizeSeconds[] = [5, 10, 20];
export const ALL_MATE_IN: MateIn[] = [1, 2, 3];

export interface WoodpeckerAccess {
  cycles: CycleCountOption[];
  counts: PuzzleCountOption[];
  difficulties: Difficulty[];
  types: PuzzleMode[];
}

export interface BlindfoldAccess {
  /** Mates: the piece limits and memorize times allowed. Empty: the mode is closed. */
  levels: BlindfoldLevel[];
  memorize: MemorizeSeconds[];
  /** How long the mate may be: in 1, 2 or 3 moves. */
  mateIn: MateIn[];
  /** Which drills may be played: square colours are free with an account, every other drill is Premium. */
  drills: DrillKind[];
  /** How long a timed drill may run: the 1 minute run, or "No time limit" (practice, no record). */
  drillLimits: DrillLimit[];
}

export interface Access {
  woodpecker: WoodpeckerAccess;
  blindfold: BlindfoldAccess;
}

export const ACCESS: Record<Tier, Access> = {
  guest: {
    woodpecker: { cycles: [2, 3], counts: [10, 50], difficulties: ['easy', 'medium'], types: ['classic'] },
    blindfold: { levels: [], memorize: [], mateIn: [], drills: [], drillLimits: [] },
  },
  free: {
    woodpecker: { cycles: [2, 3, 4], counts: [10, 50, 100], difficulties: ['easy', 'medium', 'hard'], types: ['classic'] },
    blindfold: { levels: [6, 7], memorize: [10], mateIn: [1], drills: ['color'], drillLimits: ['minute'] },
  },
  premium: {
    woodpecker: { cycles: ALL_CYCLES, counts: ALL_COUNTS, difficulties: ALL_DIFFICULTIES, types: ALL_TYPES },
    blindfold: { levels: ALL_LEVELS, memorize: ALL_MEMORIZE, mateIn: ALL_MATE_IN, drills: DRILL_KINDS, drillLimits: DRILL_LIMITS },
  },
};

export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as string[]).includes(value);
}

/** The lowest tier that has `value` in the list chosen by `pick`, or null when nobody has it. */
export function tierFor<T>(pick: (access: Access) => T[], value: T): Tier | null {
  return TIERS.find((tier) => pick(ACCESS[tier]).includes(value)) ?? null;
}

/** The lowest plan that may use "Check with engine" in Board Analysis: a signed-in account (not Premium). */
export const ENGINE_TIER: Tier = 'free';

/** True when the tier may switch the engine on. The engine runs in the browser, so this is checked there only. */
export function canUseEngine(tier: Tier): boolean {
  return TIERS.indexOf(tier) >= TIERS.indexOf(ENGINE_TIER);
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

/** Checks how many pieces a Blindfold mate round may have (the server can check this one). */
export function checkBlindfoldLevel(tier: Tier, level: BlindfoldLevel): Check {
  return ACCESS[tier].blindfold.levels.includes(level)
    ? { ok: true }
    : refuse(level === 32 ? 'Any number of pieces' : `Up to ${level} pieces`, tierFor((a) => a.blindfold.levels, level));
}

/** Checks how long a Blindfold mate may be (the server can check this one too). */
export function checkBlindfoldMateIn(tier: Tier, mateIn: MateIn): Check {
  return ACCESS[tier].blindfold.mateIn.includes(mateIn)
    ? { ok: true }
    : refuse(`Mate in ${mateIn}`, tierFor((a) => a.blindfold.mateIn, mateIn));
}

/** Checks a Blindfold mate round: how long the mate is, how many pieces at most, and how long the position is shown. */
export function checkBlindfoldMate(
  tier: Tier,
  settings: { level: BlindfoldLevel; memorize: MemorizeSeconds; mateIn?: MateIn },
): Check {
  const length = checkBlindfoldMateIn(tier, settings.mateIn ?? 1);
  if (!length.ok) return length;
  const level = checkBlindfoldLevel(tier, settings.level);
  if (!level.ok) return level;
  if (!ACCESS[tier].blindfold.memorize.includes(settings.memorize)) {
    return refuse(`${settings.memorize} seconds to memorize`, tierFor((a) => a.blindfold.memorize, settings.memorize));
  }
  return { ok: true };
}

/** The nearest settings the tier may use: the largest allowed level not above the wanted one, the closest memorize time. */
export function clampBlindfold<S extends { level: BlindfoldLevel; memorize: MemorizeSeconds; mateIn?: MateIn }>(tier: Tier, settings: S): S {
  const { levels, memorize, mateIn } = ACCESS[tier].blindfold;
  if (levels.length === 0 || memorize.length === 0) return settings;
  const level = levels.includes(settings.level)
    ? settings.level
    : [...levels].sort((a, b) => a - b).filter((l) => l <= settings.level).pop() ?? levels[0];
  const time = memorize.includes(settings.memorize)
    ? settings.memorize
    : [...memorize].sort((a, b) => Math.abs(a - settings.memorize) - Math.abs(b - settings.memorize))[0];
  const length = settings.mateIn === undefined || mateIn.includes(settings.mateIn)
    ? settings.mateIn
    : [...mateIn].sort((a, b) => a - b).filter((m) => m <= settings.mateIn!).pop() ?? mateIn[0];
  return { ...settings, level, memorize: time, ...(length === undefined ? {} : { mateIn: length }) };
}

/** The drill to show: the wanted one when allowed, else the first allowed one (or the wanted one when none is). */
export function clampDrill(tier: Tier, kind: DrillKind): DrillKind {
  const { drills } = ACCESS[tier].blindfold;
  return drills.length === 0 || drills.includes(kind) ? kind : drills[0];
}

const DRILL_NAME: Record<DrillKind, string> = {
  color: 'Square colours',
  check: 'Check or not',
  attack: 'Attacked or not',
  diagonal: 'Diagonals',
  knight: 'Knight routes',
  distance: 'Moves needed',
  count: 'Count the squares',
  endgame: 'Square and opposition',
  follow: 'Follow the moves',
  reconstruct: 'Rebuild position',
};

export function checkBlindfoldDrill(tier: Tier, kind: DrillKind): Check {
  return ACCESS[tier].blindfold.drills.includes(kind)
    ? { ok: true }
    : refuse(DRILL_NAME[kind], tierFor((a) => a.blindfold.drills, kind));
}

/** The run length to show: the wanted one when allowed, else the first allowed one (or the wanted one when none is). */
export function clampDrillLimit(tier: Tier, limit: DrillLimit): DrillLimit {
  const { drillLimits } = ACCESS[tier].blindfold;
  return drillLimits.length === 0 || drillLimits.includes(limit) ? limit : drillLimits[0];
}

/** Checks how long a drill run may be (a drill with no time limit is Premium). */
export function checkBlindfoldDrillLimit(tier: Tier, limit: DrillLimit): Check {
  return ACCESS[tier].blindfold.drillLimits.includes(limit)
    ? { ok: true }
    : refuse(limit === 'endless' ? 'A drill with no time limit' : `A ${drillLimitLabel(limit)} drill`, tierFor((a) => a.blindfold.drillLimits, limit));
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
