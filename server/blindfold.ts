// Puzzles for Blindfold: "mate in 1", "mate in 2" and "mate in 3" puzzles picked at random, limited by how many
// pieces are on the board. A puzzle's moves are the opponent's first move and then the solution, so a mate in N
// has 2N plies (mate in 1: the opponent's move, then the checkmate).
import type Database from 'better-sqlite3';
import { boardAfterFirstMove, countPieces } from '../scripts/lib/endgame-rule.mjs';
import type { LadderRow } from './ladder.ts';

/** Piece limits offered by the app. 32 means "any". */
export const BLINDFOLD_MAX_PIECES = [6, 7, 8, 10, 32] as const;

/** How many moves the mate takes. */
export const BLINDFOLD_MATE_IN = [1, 2, 3] as const;

export interface BlindfoldParams {
  maxPieces: number;
  count: number;
  /** 1, 2 or 3. Missing means 1. */
  mateIn?: number;
}

export const BLINDFOLD_LIMITS = { maxCount: 20 };

/** Returns null when the query string is not a valid Blindfold request. */
export function parseBlindfoldParams(query: Record<string, unknown>): BlindfoldParams | null {
  const maxPieces = Number(query.maxPieces ?? 32);
  const count = Number(query.count ?? 10);
  const mateIn = Number(query.mateIn ?? 1);
  if (!(BLINDFOLD_MAX_PIECES as readonly number[]).includes(maxPieces)) return null;
  if (!Number.isInteger(count) || count < 1 || count > BLINDFOLD_LIMITS.maxCount) return null;
  if (!(BLINDFOLD_MATE_IN as readonly number[]).includes(mateIn)) return null;
  return { maxPieces, count, mateIn };
}

interface Candidate {
  id: string;
  pieces: number;
}

// Each list of puzzles (about 10,000 ids for mate in 1, 9,000 for mate in 2, 3,000 for mate in 3) is built once
// per database and kept in memory.
const candidateCache = new WeakMap<Database.Database, Map<number, Candidate[]>>();

function loadCandidates(database: Database.Database, mateIn: number): Candidate[] {
  let byLength = candidateCache.get(database);
  if (!byLength) {
    byLength = new Map();
    candidateCache.set(database, byLength);
  }
  const cached = byLength.get(mateIn);
  if (cached) return cached;
  // Longer mates also need Lichess's "mateInN" tag: four plies are not always a mate in 2.
  const tag = mateIn === 1 ? '' : `AND ' ' || themes || ' ' LIKE '% mateIn${mateIn} %'`;
  const rows = database
    .prepare(
      `SELECT puzzle_id, fen, moves FROM puzzles
       WHERE length(moves) - length(replace(moves, ' ', '')) = ? ${tag}`,
    )
    .all(mateIn * 2 - 1) as Array<{ puzzle_id: string; fen: string; moves: string }>;
  const candidates: Candidate[] = [];
  for (const row of rows) {
    const board = boardAfterFirstMove(row.fen, row.moves.split(' ')[0]);
    if (!board) continue;
    candidates.push({ id: row.puzzle_id, pieces: countPieces(board) });
  }
  byLength.set(mateIn, candidates);
  return candidates;
}

/** How many puzzles each piece limit has (for tests and the stats line). */
export function blindfoldPoolSizes(database: Database.Database, mateIn = 1): Record<number, number> {
  const candidates = loadCandidates(database, mateIn);
  const sizes: Record<number, number> = {};
  for (const limit of BLINDFOLD_MAX_PIECES) {
    sizes[limit] = candidates.filter((c) => c.pieces <= limit).length;
  }
  return sizes;
}

/** `count` different random puzzles (mate in 1 unless `mateIn` says otherwise) with at most `maxPieces` pieces. */
export function pickBlindfoldPuzzles(
  database: Database.Database,
  { maxPieces, count, mateIn = 1 }: BlindfoldParams,
  rng: () => number = Math.random,
): LadderRow[] {
  const pool = loadCandidates(database, mateIn).filter((c) => c.pieces <= maxPieces);
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
