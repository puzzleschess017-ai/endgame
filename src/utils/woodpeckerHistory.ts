// Finished Woodpecker cycles, kept in localStorage so Home can show progress. The trainer itself
// only keeps the current session; this is the long-term record (newest last, capped).
import type { CycleResult, TrainingSession } from '../types';
import { recordActivity } from './activity';

export const WOODPECKER_HISTORY_STORAGE_KEY = 'ctg_woodpecker_history_v1';
export const WOODPECKER_HISTORY_LIMIT = 300;

export interface WoodpeckerCycleRecord {
  /** `${sessionId}:${cycleNumber}`, so the same cycle is never counted twice. */
  key: string;
  completedAt: number;
  correct: number;
  incorrect: number;
  /** 0-100. */
  accuracy: number;
  timeMs: number;
  puzzleCount: number;
  difficulty: string;
}

export function loadWoodpeckerHistory(): WoodpeckerCycleRecord[] {
  try {
    const raw = localStorage.getItem(WOODPECKER_HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is WoodpeckerCycleRecord =>
        r && typeof r.key === 'string' && typeof r.accuracy === 'number' && typeof r.timeMs === 'number',
    );
  } catch {
    return [];
  }
}

/**
 * Keys of the cycles this browser has already counted, kept apart from the history on purpose: signing out
 * removes the account's history from the browser, but the saved Woodpecker session stays. Without this list
 * its finished cycles would be counted again (and added to the account a second time on the next sign-in).
 */
export const WOODPECKER_COUNTED_STORAGE_KEY = 'ctg_woodpecker_counted_v1';
const COUNTED_LIMIT = 1000;

function loadCounted(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WOODPECKER_COUNTED_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Adds the cycles of `session` that are not in the history yet. Returns how many were new. */
export function recordFinishedCycles(
  session: Pick<TrainingSession, 'id' | 'config' | 'cycleResults'> | null,
): number {
  if (!session || session.cycleResults.length === 0) return 0;
  const history = loadWoodpeckerHistory();
  const counted = loadCounted();
  const known = new Set([...history.map((r) => r.key), ...counted]);
  const added: WoodpeckerCycleRecord[] = [];
  for (const result of session.cycleResults as CycleResult[]) {
    const key = `${session.id}:${result.cycleNumber}`;
    if (known.has(key)) continue;
    added.push({
      key,
      completedAt: result.completedAt,
      correct: result.correct,
      incorrect: result.incorrect,
      accuracy: result.accuracy,
      timeMs: result.totalTimeMs,
      puzzleCount: session.config.puzzleCount,
      difficulty: session.config.difficulty,
    });
  }
  if (added.length === 0) return 0;
  try {
    localStorage.setItem(
      WOODPECKER_COUNTED_STORAGE_KEY,
      JSON.stringify([...counted, ...added.map((r) => r.key)].slice(-COUNTED_LIMIT)),
    );
  } catch {
    // ignore storage errors
  }
  for (const r of added) {
    recordActivity({
      mode: 'woodpecker',
      ms: r.timeMs,
      correct: r.correct,
      wrong: r.incorrect,
      puzzles: r.correct,
      now: r.completedAt,
    });
  }
  try {
    const next = [...history, ...added].slice(-WOODPECKER_HISTORY_LIMIT);
    localStorage.setItem(WOODPECKER_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return added.length;
}

export interface WoodpeckerSummary {
  cycles: number;
  puzzlesSolved: number;
  bestAccuracy: number;
  /** Fastest cycle with 100% accuracy, or null. */
  fastestPerfectMs: number | null;
}

export function summarizeWoodpecker(history: WoodpeckerCycleRecord[]): WoodpeckerSummary {
  let puzzlesSolved = 0;
  let bestAccuracy = 0;
  let fastestPerfectMs: number | null = null;
  for (const r of history) {
    puzzlesSolved += r.correct;
    bestAccuracy = Math.max(bestAccuracy, r.accuracy);
    if (r.incorrect === 0 && r.correct > 0 && (fastestPerfectMs === null || r.timeMs < fastestPerfectMs)) {
      fastestPerfectMs = r.timeMs;
    }
  }
  return { cycles: history.length, puzzlesSolved, bestAccuracy: Math.round(bestAccuracy), fastestPerfectMs };
}
