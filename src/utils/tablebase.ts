// Client side of the endgame tablebase: what to ask, how to word the answer.

export type Outcome = 'win' | 'cursed-win' | 'draw' | 'blessed-loss' | 'loss' | 'unknown';

export interface TablebaseMove {
  uci: string;
  san: string;
  /** What the move leads to for the player who makes it. */
  outcome: Outcome;
  checkmate: boolean;
  zeroing: boolean;
}

export interface TablebaseResult {
  fen: string;
  /** Result for the side to move. */
  outcome: Outcome;
  /** Moves until checkmate with best play, or null when the tables do not say. */
  matein: number | null;
  checkmate: boolean;
  stalemate: boolean;
  insufficientMaterial: boolean;
  /** Legal moves, best first. */
  moves: TablebaseMove[];
}

export const TABLEBASE_MAX_PIECES = 7;

export function countPieces(fen: string): number {
  return (fen.split(' ')[0].match(/[pnbrqkPNBRQK]/g) ?? []).length;
}

/** Why a position cannot be looked up, or null when it can. */
export function lookupProblem(fen: string): string | null {
  const pieces = countPieces(fen);
  if (pieces > TABLEBASE_MAX_PIECES) {
    return `The tablebase covers positions with ${TABLEBASE_MAX_PIECES} pieces or fewer. This one has ${pieces}.`;
  }
  const castling = fen.split(' ')[2];
  if (castling && castling !== '-') {
    return 'The tablebase does not handle castling. Remove the castling rights in the Board Editor to look this position up.';
  }
  return null;
}

export type Tone = 'good' | 'neutral' | 'bad';

export interface Verdict {
  headline: string;
  detail?: string;
  tone: Tone;
}

/** The answer for a position in words, for the side to move. */
export function verdictText(result: TablebaseResult, turn: 'w' | 'b'): Verdict {
  const side = turn === 'w' ? 'White' : 'Black';
  const other = turn === 'w' ? 'Black' : 'White';
  if (result.checkmate) return { headline: `Checkmate, ${other} wins`, tone: 'neutral' };
  if (result.stalemate) return { headline: 'Stalemate, a draw', tone: 'neutral' };
  if (result.insufficientMaterial) return { headline: 'Draw, not enough material', tone: 'neutral' };
  const mate = result.matein === null ? undefined : `Mate in ${result.matein} with best play`;
  switch (result.outcome) {
    case 'win':
      return { headline: `${side} wins`, detail: mate, tone: 'good' };
    case 'loss':
      return { headline: `${other} wins`, detail: mate, tone: 'bad' };
    case 'draw':
      return { headline: 'Draw', detail: 'Neither side can win with correct play.', tone: 'neutral' };
    case 'cursed-win':
      return {
        headline: 'Draw by the 50-move rule',
        detail: `${side} is winning, but not fast enough: the win takes more than 50 moves without a capture or pawn move.`,
        tone: 'neutral',
      };
    case 'blessed-loss':
      return {
        headline: 'Draw by the 50-move rule',
        detail: `${other} is winning, but not fast enough: the win takes more than 50 moves without a capture or pawn move.`,
        tone: 'neutral',
      };
    default:
      return { headline: 'No answer for this position', tone: 'neutral' };
  }
}

/** Short word for what a move leads to, for the player making it. */
export function moveLabel(move: TablebaseMove): { text: string; tone: Tone } {
  if (move.checkmate) return { text: 'Checkmate', tone: 'good' };
  switch (move.outcome) {
    case 'win':
      return { text: 'Wins', tone: 'good' };
    case 'loss':
      return { text: 'Loses', tone: 'bad' };
    case 'draw':
      return { text: 'Draws', tone: 'neutral' };
    case 'cursed-win':
    case 'blessed-loss':
      return { text: 'Draws (50-move rule)', tone: 'neutral' };
    default:
      return { text: '?', tone: 'neutral' };
  }
}

export type TablebaseAnswer = { ok: true; result: TablebaseResult } | { ok: false; error: string };

/** Asks our server for a position. Never throws: every failure comes back with a message. */
export async function fetchTablebase(fen: string, signal?: AbortSignal): Promise<TablebaseAnswer> {
  try {
    const response = await fetch(`/api/tablebase?fen=${encodeURIComponent(fen)}`, { signal });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : 'The tablebase could not be reached.';
      return { ok: false, error };
    }
    const result = body as TablebaseResult | null;
    if (!result || !Array.isArray(result.moves) || typeof result.outcome !== 'string') {
      return { ok: false, error: 'The tablebase gave an answer that could not be read.' };
    }
    return { ok: true, result };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { ok: false, error: 'The tablebase could not be reached. Check your connection and try again.' };
  }
}

export interface Example {
  id: string;
  label: string;
  fen: string;
}

export const EXAMPLES: Example[] = [
  { id: 'kqk', label: 'King and queen vs king', fen: '8/8/8/4k3/8/8/2Q5/4K3 w - - 0 1' },
  { id: 'krk', label: 'King and rook vs king', fen: '8/8/8/4k3/8/8/2R5/4K3 w - - 0 1' },
  { id: 'kpk', label: 'King and pawn vs king', fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1' },
  { id: 'lucena', label: 'Lucena position (rook endgame)', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1' },
];
