// Reading what a chess engine says (the UCI protocol) and turning it into things to show. Pure functions, no
// browser code, so they are tested without an engine.
import { Chess } from 'chess.js';

export interface EngineLine {
  /** 1 = the best line, 2 = the second best... */
  multipv: number;
  depth: number;
  /** Centipawns for the side to move, or null when the line is a forced mate. */
  cp: number | null;
  /** Moves to mate for the side to move (negative: the side to move gets mated), or null. */
  mate: number | null;
  /** The line as moves such as "e2e4". */
  pv: string[];
}

/** One "info ..." line of the engine. Lines without a depth, a score and moves (for example "info string") give null. */
export function parseInfo(text: string): EngineLine | null {
  const words = text.trim().split(/\s+/);
  if (words[0] !== 'info') return null;
  const at = (name: string) => words.indexOf(name);
  const number = (name: string): number | null => {
    const i = at(name);
    const value = i >= 0 ? Number(words[i + 1]) : NaN;
    return Number.isFinite(value) ? value : null;
  };
  const depth = number('depth');
  const scoreAt = at('score');
  const pvAt = at('pv');
  if (depth === null || scoreAt < 0 || pvAt < 0) return null;
  const kind = words[scoreAt + 1];
  const value = Number(words[scoreAt + 2]);
  if (!Number.isFinite(value) || (kind !== 'cp' && kind !== 'mate')) return null;
  // "lowerbound" and "upperbound" are searches that were cut off: not a result worth showing.
  if (words[scoreAt + 3] === 'lowerbound' || words[scoreAt + 3] === 'upperbound') return null;
  const pv = words.slice(pvAt + 1).filter((m) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m));
  if (pv.length === 0) return null;
  return {
    multipv: number('multipv') ?? 1,
    depth,
    cp: kind === 'cp' ? value : null,
    mate: kind === 'mate' ? value : null,
    pv,
  };
}

/** The move of "bestmove e2e4 ponder e7e5" or null for "bestmove (none)". */
export function parseBestMove(text: string): string | null {
  const words = text.trim().split(/\s+/);
  if (words[0] !== 'bestmove') return null;
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(words[1] ?? '') ? words[1] : null;
}

/** The engine counts for the side to move. People read it for White: positive is good for White. */
export function forWhite(line: EngineLine, turn: 'w' | 'b'): EngineLine {
  if (turn === 'w') return line;
  return { ...line, cp: line.cp === null ? null : -line.cp, mate: line.mate === null ? null : -line.mate };
}

/** "+0.6", "-1.30", "0.0", "M3" (White mates in 3) or "-M2" (Black mates in 2), for a line already seen from White's side. */
export function formatScore(line: Pick<EngineLine, 'cp' | 'mate'>): string {
  if (line.mate !== null) {
    if (line.mate === 0) return '#';
    return line.mate > 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  }
  const pawns = (line.cp ?? 0) / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  return `${pawns > 0 ? '+' : '-'}${Math.abs(pawns).toFixed(1)}`;
}

/** How much of the bar is White's, 0 to 100, from a line already seen from White's side. 50 is equal. */
export function whiteShare(line: Pick<EngineLine, 'cp' | 'mate'>): number {
  if (line.mate !== null) return line.mate > 0 ? 100 : line.mate < 0 ? 0 : 50;
  const cp = Math.max(-2000, Math.min(2000, line.cp ?? 0));
  // The same curve the big chess sites use: +1 pawn is about 59%, +3 pawns about 75%.
  return Math.round((50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)) * 10) / 10;
}

/** Moves such as "e2e4 e7e5" as notation from a position ("e4 e5"). Stops at the first move that is not legal there. */
export function pvToSan(fen: string, pv: string[], maxPlies = 10): string[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const uci of pv.slice(0, maxPlies)) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      out.push(move.san);
    } catch {
      break;
    }
  }
  return out;
}

/** "1. e4 e5 2. Nf3" or, when Black is to move, "1... e5 2. Nf3", for the moves of `pvToSan`. */
export function numberMoves(fen: string, san: string[]): string {
  const parts = fen.trim().split(/\s+/);
  let number = Number(parts[5]) || 1;
  let white = parts[1] !== 'b';
  const out: string[] = [];
  san.forEach((move, i) => {
    if (white) out.push(`${number}.`);
    else if (i === 0) out.push(`${number}...`);
    out.push(move);
    if (!white) number += 1;
    white = !white;
  });
  return out.join(' ');
}
