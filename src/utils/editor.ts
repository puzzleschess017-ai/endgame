import { Chess } from 'chess.js';

export const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
export const EMPTY_PLACEMENT = '8/8/8/8/8/8/8/8';
export const START_FEN = `${START_PLACEMENT} w KQkq - 0 1`;

export interface Castling {
  K: boolean;
  Q: boolean;
  k: boolean;
  q: boolean;
}

/** A position as the board editor holds it. `ep` is the file ("a"–"h") of an en passant capture, or null. */
export interface EditorPosition {
  placement: string;
  turn: 'w' | 'b';
  castling: Castling;
  ep: string | null;
  halfmove: number;
  fullmove: number;
}

export const NO_CASTLING: Castling = { K: false, Q: false, k: false, q: false };

export function startPosition(): EditorPosition {
  return {
    placement: START_PLACEMENT,
    turn: 'w',
    castling: { K: true, Q: true, k: true, q: true },
    ep: null,
    halfmove: 0,
    fullmove: 1,
  };
}

export function emptyPosition(): EditorPosition {
  return { ...startPosition(), placement: EMPTY_PLACEMENT, castling: { ...NO_CASTLING } };
}

/** The 8 ranks of a placement as 8 arrays of 8 characters ('' = empty), rank 8 first. */
function ranksOf(placement: string): string[][] | null {
  const rows = placement.split('/');
  if (rows.length !== 8) return null;
  const out: string[][] = [];
  for (const row of rows) {
    const cells: string[] = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) cells.push(...Array<string>(Number(ch)).fill(''));
      else if (/[pnbrqkPNBRQK]/.test(ch)) cells.push(ch);
      else return null;
    }
    if (cells.length !== 8) return null;
    out.push(cells);
  }
  return out;
}

/** The piece on a square like "e4" ('' when empty, null for a broken placement). */
function pieceAt(ranks: string[][], square: string): string {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return ranks[8 - rank][file];
}

/**
 * Castling rights that are still possible: the king and the rook must stand on their home squares.
 * (A board editor lets people move the pieces around, so the rights are cleaned up when the FEN is made.)
 */
export function possibleCastling(placement: string, wanted: Castling): Castling {
  const ranks = ranksOf(placement);
  if (!ranks) return { ...NO_CASTLING };
  return {
    K: wanted.K && pieceAt(ranks, 'e1') === 'K' && pieceAt(ranks, 'h1') === 'R',
    Q: wanted.Q && pieceAt(ranks, 'e1') === 'K' && pieceAt(ranks, 'a1') === 'R',
    k: wanted.k && pieceAt(ranks, 'e8') === 'k' && pieceAt(ranks, 'h8') === 'r',
    q: wanted.q && pieceAt(ranks, 'e8') === 'k' && pieceAt(ranks, 'a8') === 'r',
  };
}

/**
 * The en passant square for a file, or '-' when no capture is possible: the pawn that just moved two
 * squares has to be there, with both squares behind it empty.
 */
export function enPassantSquare(placement: string, turn: 'w' | 'b', file: string | null): string {
  if (!file || !/^[a-h]$/.test(file)) return '-';
  const ranks = ranksOf(placement);
  if (!ranks) return '-';
  // White to move: Black's pawn just went from rank 7 to rank 5 and is passed on rank 6.
  const [target, pawnSquare, startSquare, pawn] =
    turn === 'w' ? [`${file}6`, `${file}5`, `${file}7`, 'p'] : [`${file}3`, `${file}4`, `${file}2`, 'P'];
  if (pieceAt(ranks, pawnSquare) !== pawn) return '-';
  if (pieceAt(ranks, target) !== '' || pieceAt(ranks, startSquare) !== '') return '-';
  return target;
}

export function buildFen(position: EditorPosition): string {
  const c = possibleCastling(position.placement, position.castling);
  const rights = `${c.K ? 'K' : ''}${c.Q ? 'Q' : ''}${c.k ? 'k' : ''}${c.q ? 'q' : ''}` || '-';
  const ep = enPassantSquare(position.placement, position.turn, position.ep);
  const halfmove = Math.max(0, Math.floor(position.halfmove) || 0);
  const fullmove = Math.max(1, Math.floor(position.fullmove) || 1);
  return `${position.placement} ${position.turn} ${rights} ${ep} ${halfmove} ${fullmove}`;
}

export type ParsedFen = { ok: true; position: EditorPosition } | { ok: false; error: string };

/** Reads a FEN into an editor position. The position does not have to be legal (see validateFen). */
export function parseFen(text: string): ParsedFen {
  const parts = text.trim().split(/\s+/);
  if (parts[0] === '') return { ok: false, error: 'Enter a FEN first.' };
  if (!ranksOf(parts[0])) return { ok: false, error: 'The piece placement is not valid (8 ranks of 8 squares).' };
  const turn = parts[1] ?? 'w';
  if (turn !== 'w' && turn !== 'b') return { ok: false, error: 'The side to move must be w or b.' };
  const rights = parts[2] ?? '-';
  if (!/^(-|[KQkq]{1,4})$/.test(rights)) return { ok: false, error: 'The castling field is not valid.' };
  const epField = parts[3] ?? '-';
  if (!/^(-|[a-h][36])$/.test(epField)) return { ok: false, error: 'The en passant square is not valid.' };
  const halfmove = parts[4] === undefined ? 0 : Number(parts[4]);
  const fullmove = parts[5] === undefined ? 1 : Number(parts[5]);
  if (!Number.isInteger(halfmove) || halfmove < 0 || !Number.isInteger(fullmove) || fullmove < 1) {
    return { ok: false, error: 'The move counters must be whole numbers.' };
  }
  return {
    ok: true,
    position: {
      placement: parts[0],
      turn,
      castling: { K: rights.includes('K'), Q: rights.includes('Q'), k: rights.includes('k'), q: rights.includes('q') },
      ep: epField === '-' ? null : epField[0],
      halfmove,
      fullmove,
    },
  };
}

export type Validation = { ok: true } | { ok: false; reason: string };

/** Says whether a position can be analysed (a legal chess position), and if not, why not. */
export function validateFen(fen: string): Validation {
  const parsed = parseFen(fen);
  if (!parsed.ok) return { ok: false, reason: parsed.error };
  const ranks = ranksOf(parsed.position.placement)!;
  const flat = ranks.flat();
  const count = (piece: string) => flat.filter((p) => p === piece).length;
  if (count('K') !== 1) return { ok: false, reason: count('K') === 0 ? 'White needs a king.' : 'White can only have one king.' };
  if (count('k') !== 1) return { ok: false, reason: count('k') === 0 ? 'Black needs a king.' : 'Black can only have one king.' };
  if (ranks[0].some((p) => p === 'P' || p === 'p') || ranks[7].some((p) => p === 'P' || p === 'p')) {
    return { ok: false, reason: 'Pawns cannot stand on the first or last rank.' };
  }
  try {
    const chess = new Chess(buildFen(parsed.position));
    // The side that is NOT to move cannot be in check.
    const waiting = parsed.position.turn === 'w' ? 'b' : 'w';
    const king = flat.indexOf(waiting === 'w' ? 'K' : 'k');
    const square = `${String.fromCharCode(97 + (king % 8))}${8 - Math.floor(king / 8)}` as Parameters<Chess['isAttacked']>[0];
    if (chess.isAttacked(square, parsed.position.turn)) {
      return { ok: false, reason: `${waiting === 'w' ? 'White' : 'Black'} is in check but it is not their turn.` };
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message.replace(/^Invalid FEN: /, '') : 'The position is not valid.' };
  }
  return { ok: true };
}

/** The piece placement of a FEN ("rnbqkbnr/..."), for comparing boards. */
export function placementOf(fen: string): string {
  return fen.trim().split(/\s+/)[0] ?? '';
}
