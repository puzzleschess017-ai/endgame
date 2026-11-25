// Woodpecker progress: the finished cycles grouped by set (one run of the trainer), so the speed and the
// accuracy of cycle 1, 2, 3... of the same puzzles can be compared. Pure helpers, no browser code.
import type { WoodpeckerCycleRecord } from './woodpeckerHistory.ts';

export interface ProgressCycle {
  cycle: number;
  /** Seconds per puzzle. */
  seconds: number;
  /** 0-100. */
  accuracy: number;
  timeMs: number;
  /** Puzzles solved without a mistake / puzzles in the cycle. */
  solved: number;
  total: number;
  completedAt: number;
}

export interface ProgressSet {
  id: string;
  /** When its latest cycle was finished. */
  completedAt: number;
  puzzleCount: number;
  difficulty: string;
  cycles: ProgressCycle[];
}

/** The id of the set is the part of the record key before the cycle number ("<session id>:<cycle>"). */
export function setIdOf(key: string): string {
  const i = key.lastIndexOf(':');
  return i > 0 ? key.slice(0, i) : key;
}

/** Sets with their cycles in order, the most recently trained set first. */
export function groupSets(history: WoodpeckerCycleRecord[]): ProgressSet[] {
  const sets = new Map<string, ProgressSet>();
  const ordered = [...history].sort((a, b) => a.completedAt - b.completedAt);
  for (const r of ordered) {
    const id = setIdOf(r.key);
    const total = r.correct + r.incorrect;
    if (total <= 0 || r.timeMs < 0) continue;
    let set = sets.get(id);
    if (!set) {
      set = { id, completedAt: r.completedAt, puzzleCount: r.puzzleCount, difficulty: r.difficulty, cycles: [] };
      sets.set(id, set);
    }
    const suffix = Number(r.key.slice(r.key.lastIndexOf(':') + 1));
    set.completedAt = r.completedAt;
    set.cycles.push({
      cycle: Number.isInteger(suffix) && suffix > 0 && r.key.includes(':') ? suffix : set.cycles.length + 1,
      seconds: r.timeMs / 1000 / total,
      accuracy: r.accuracy,
      timeMs: r.timeMs,
      solved: r.correct,
      total,
      completedAt: r.completedAt,
    });
  }
  for (const set of sets.values()) set.cycles.sort((a, b) => a.cycle - b.cycle);
  return [...sets.values()].sort((a, b) => b.completedAt - a.completedAt);
}

/** "Cycle 4 is 38% faster than cycle 1", or null while there is only one cycle. */
export function speedSummary(set: ProgressSet): string | null {
  if (set.cycles.length < 2) return null;
  const first = set.cycles[0];
  const last = set.cycles[set.cycles.length - 1];
  if (first.seconds <= 0) return null;
  const change = ((first.seconds - last.seconds) / first.seconds) * 100;
  const pct = Math.round(Math.abs(change));
  if (pct < 1) return `Cycle ${last.cycle} took about as long as cycle ${first.cycle}`;
  return `Cycle ${last.cycle} is ${pct}% ${change > 0 ? 'faster' : 'slower'} than cycle ${first.cycle}`;
}

/** Bounds of the accuracy axis: a round number under the lowest value (but not below 0), up to 100. */
export function accuracyAxis(values: number[]): { min: number; max: number } {
  const lowest = values.length ? Math.min(...values) : 0;
  return { min: Math.max(0, Math.floor((lowest - 5) / 10) * 10), max: 100 };
}
