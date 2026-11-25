// "Review": after a Woodpecker cycle, the puzzles worth practising again: the ones that were missed (a wrong
// move or the arrow) and the slowest ones. Pure helpers, no browser code.
import type { Puzzle, PuzzleAttempt, TrainingSession } from '../types';

/** At least this many puzzles are offered (the slowest ones fill up what the missed ones do not reach). */
export const REVIEW_MIN = 5;

export interface ReviewItem {
  id: string;
  reason: 'missed' | 'slow';
  ms: number;
}

export interface ReviewSet {
  items: ReviewItem[];
  missed: number;
  slow: number;
}

/**
 * Every missed puzzle (slowest first), then the slowest solved ones until there are `REVIEW_MIN`.
 * A cycle with fewer puzzles than that offers all of them.
 */
export function selectReview(attempts: PuzzleAttempt[] | undefined, min: number = REVIEW_MIN): ReviewSet {
  const list = (attempts ?? []).filter((a) => typeof a.id === 'string');
  const missed = list.filter((a) => a.failed).sort((a, b) => b.ms - a.ms);
  const rest = list.filter((a) => !a.failed).sort((a, b) => b.ms - a.ms);
  const slowCount = Math.max(0, Math.min(rest.length, min - missed.length));
  const items: ReviewItem[] = [
    ...missed.map((a) => ({ id: a.id, reason: 'missed' as const, ms: a.ms })),
    ...rest.slice(0, slowCount).map((a) => ({ id: a.id, reason: 'slow' as const, ms: a.ms })),
  ];
  return { items, missed: missed.length, slow: slowCount };
}

/** The puzzles of a review set, in the order of the original set (so the run is not shuffled). */
export function reviewPuzzles(puzzles: Puzzle[], items: ReviewItem[]): Puzzle[] {
  const wanted = new Set(items.map((i) => i.id));
  return puzzles.filter((p) => wanted.has(p.puzzleId));
}

/** How many cycles a review run has: two, so a puzzle is seen again straight away (the minimum of the trainer). */
export const REVIEW_CYCLES = 2;

/** Keeps the attempts of the latest result only, so a long session does not fill the browser's storage. */
export function trimOldAttempts<T extends { attempts?: PuzzleAttempt[] }>(results: T[]): T[] {
  return results.map((r, i) => (i === results.length - 1 || !r.attempts ? r : { ...r, attempts: undefined }));
}

/** A fresh session for practising only the puzzles of `items`. */
export function reviewSession(from: Pick<TrainingSession, 'config' | 'puzzles'>, items: ReviewItem[], id: string): TrainingSession {
  const puzzles = reviewPuzzles(from.puzzles, items);
  return {
    id,
    config: { ...from.config, puzzleCount: puzzles.length as TrainingSession['config']['puzzleCount'], totalCycles: REVIEW_CYCLES },
    puzzles,
    currentCycle: 1,
    currentPuzzleIndex: 0,
    cycleCorrect: 0,
    cycleIncorrect: 0,
    cycleElapsedMs: 0,
    puzzleElapsedMs: 0,
    currentPuzzleFailed: false,
    status: 'training',
    cycleResults: [],
    cycleAttempts: [],
    review: true,
  };
}
