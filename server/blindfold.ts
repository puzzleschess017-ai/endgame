// Puzzles for Blindfold: every "mate in 1" puzzle (the solution is two plies: the opponent's move,
// then the checkmate), picked at random, limited by how many pieces are on the board.
import type Database from 'better-sqlite3';
import { boardAfterFirstMove, countPieces } from '../scripts/lib/endgame-rule.mjs';
import type { LadderRow } from './ladder.ts';

/** Piece limits offered by the app. 32 means "any". */
export const BLINDFOLD_MAX_PIECES = [6, 7, 8, 10, 32] as const;

export interface BlindfoldParams {
  maxPieces: number;
  count: number;
}

export const BLINDFOLD_LIMITS = { maxCount: 20 };

/** Returns null when the query string is not a valid Blindfold request. */
export function parseBlindfoldParams(query: Record<string, unknown>): BlindfoldParams | null {
  const maxPieces = Number(query.maxPieces ?? 32);
  const count = Number(query.count ?? 10);
  if (!(BLINDFOLD_MAX_PIECES as readonly number[]).includes(maxPieces)) return null;
  if (!Number.isInteger(count) || count < 1 || count > BLINDFOLD_LIMITS.maxCount) return null;
  return { maxPieces, count };
}

interface Candidate {
  id: string;
  pieces: number;
}

// The list of mate-in-1 puzzles (about 10,000 ids) is built once per database and kept in memory.
const candidateCache = new WeakMap<Database.Database, Candidate[]>();

function loadCandidates(database: Database.Database): Candidate[] {
  const cached = candidateCache.get(database);
  if (cached) return cached;
  const rows = database
    .prepare(
      `SELECT puzzle_id, fen, moves FROM puzzles
       WHERE length(moves) - length(replace(moves, ' ', '')) = 1`,
    )
    .all() as Array<{ puzzle_id: string; fen: string; moves: string }>;
  const candidates: Candidate[] = [];
  for (const row of rows) {
    const board = boardAfterFirstMove(row.fen, row.moves.split(' ')[0]);
    if (!board) continue;
    candidates.push({ id: row.puzzle_id, pieces: countPieces(board) });
  }
  candidateCache.set(database, candidates);
  return candidates;
}

/** How many puzzles each piece limit has (for tests and the stats line). */
export function blindfoldPoolSizes(database: Database.Database): Record<number, number> {
  const candidates = loadCandidates(database);
  const sizes: Record<number, number> = {};
  for (const limit of BLINDFOLD_MAX_PIECES) {
    sizes[limit] = candidates.filter((c) => c.pieces <= limit).length;
  }
  return sizes;
}

/** `count` different random mate-in-1 puzzles with at most `maxPieces` pieces on the board. */
export function pickBlindfoldPuzzles(
  database: Database.Database,
  { maxPieces, count }: BlindfoldParams,
  rng: () => number = Math.random,
): LadderRow[] {
  const pool = loadCandidates(database).filter((c) => c.pieces <= maxPieces);
  const wanted = Math.min(count, pool.length);
  // Partial Fisher-Yates shuffle: only the first `wanted` places are needed.
  for (let i = 0; i < wanted; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const ids = pool.slice(0, wanted).map((c) => c.id);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = database
    .prepare(
      `SELECT puzzle_id, fen, moves, rating, rating_deviation, popularity, themes
       FROM puzzles WHERE puzzle_id IN (${placeholders})`,
    )
    .all(...ids) as LadderRow[];
  const byId = new Map(rows.map((r) => [r.puzzle_id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is LadderRow => Boolean(r));
}
