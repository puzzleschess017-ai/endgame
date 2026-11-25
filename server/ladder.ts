// "Ladder" of puzzles for Streak and Survival: one puzzle per step of rating, easy first.
// Uses every puzzle in the database (not only endgames).
import type Database from 'better-sqlite3';

export interface LadderRow {
  puzzle_id: string;
  fen: string;
  moves: string;
  rating: number;
  rating_deviation?: number;
  popularity?: number;
  themes: string;
}

export interface LadderParams {
  start: number;
  step: number;
  count: number;
}

export const LADDER_LIMITS = {
  minStart: 0,
  maxStart: 3200,
  minStep: 5,
  maxStep: 100,
  maxCount: 60,
};

/** Longest solution (in plies, opponent's first move included) that Streak and Survival will use. */
const MAX_MOVES_PER_PUZZLE = 8;
const MAX_RAND_KEY = 2147483647;

/** Target rating of every rung: start, start + step, start + 2 * step ... */
export function ladderTargets({ start, step, count }: LadderParams): number[] {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/** Returns null when the query string is not a valid ladder request. */
export function parseLadderParams(query: Record<string, unknown>): LadderParams | null {
  const start = Number(query.start ?? 500);
  const step = Number(query.step ?? 30);
  const count = Number(query.count ?? 30);
  const L = LADDER_LIMITS;
  if (!Number.isInteger(start) || start < L.minStart || start > L.maxStart) return null;
  if (!Number.isInteger(step) || step < L.minStep || step > L.maxStep) return null;
  if (!Number.isInteger(count) || count < 1 || count > L.maxCount) return null;
  return { start, step, count };
}

/**
 * One random puzzle close to `target`. The window starts at +/- half a step and doubles until a
 * puzzle is found (the extremes of the rating range have few puzzles).
 */
function pickNear(
  database: Database.Database,
  target: number,
  halfWindow: number,
  usedIds: Set<string>,
): LadderRow | null {
  const sql = `
    SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes
    FROM puzzles
    WHERE rating >= ? AND rating <= ?
      AND (length(moves) - length(replace(moves, ' ', '')) + 1) <= ${MAX_MOVES_PER_PUZZLE}
      AND rand_key >= ?
    ORDER BY rand_key ASC
    LIMIT 8
  `;
  const sqlWrap = sql.replace('rand_key >= ?', 'rand_key < ?');
  for (let window = Math.max(5, halfWindow); window <= 400; window *= 2) {
    const pivot = 1 + Math.floor(Math.random() * (MAX_RAND_KEY - 1));
    const lo = target - window;
    const hi = target + window;
    const rows = [
      ...(database.prepare(sql).all(lo, hi, pivot) as LadderRow[]),
      ...(database.prepare(sqlWrap).all(lo, hi, pivot) as LadderRow[]),
    ];
    const fresh = rows.filter((r) => !usedIds.has(r.puzzle_id));
    if (fresh.length > 0) return fresh[Math.floor(Math.random() * fresh.length)];
  }
  return null;
}

export function pickLadderPuzzles(database: Database.Database, params: LadderParams): LadderRow[] {
  const used = new Set<string>();
  const out: LadderRow[] = [];
  for (const target of ladderTargets(params)) {
    const row = pickNear(database, target, Math.ceil(params.step / 2), used);
    if (!row) continue;
    used.add(row.puzzle_id);
    out.push(row);
  }
  // Each rung is picked inside a window, so neighbours can swap; keep the ladder strictly easy -> hard.
  return out.sort((a, b) => a.rating - b.rating);
}
