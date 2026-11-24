import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { START_FEN } from './editor';

export interface AnalysisMove {
  san: string;
  uci: string;
  from: string;
  to: string;
  /** Position after the move. */
  fen: string;
  capture: boolean;
  check: boolean;
}

/** A game being looked at: the position it started from, the moves played and the move shown now. */
export interface Analysis {
  startFen: string;
  moves: AnalysisMove[];
  /** 0 = the starting position, n = after the n-th move. */
  index: number;
}

export function createAnalysis(startFen: string = START_FEN): Analysis {
  return { startFen, moves: [], index: 0 };
}

export function positionAt(analysis: Analysis, index: number = analysis.index): string {
  return index <= 0 ? analysis.startFen : analysis.moves[Math.min(index, analysis.moves.length) - 1].fen;
}

export function currentFen(analysis: Analysis): string {
  return positionAt(analysis);
}

export function lastMoveAt(analysis: Analysis, index: number = analysis.index): AnalysisMove | undefined {
  return index > 0 ? analysis.moves[index - 1] : undefined;
}

export function goTo(analysis: Analysis, index: number): Analysis {
  const clamped = Math.max(0, Math.min(analysis.moves.length, index));
  return clamped === analysis.index ? analysis : { ...analysis, index: clamped };
}

export const toStart = (a: Analysis) => goTo(a, 0);
export const toEnd = (a: Analysis) => goTo(a, a.moves.length);
export const back = (a: Analysis) => goTo(a, a.index - 1);
export const forward = (a: Analysis) => goTo(a, a.index + 1);

export interface PlayResult {
  analysis: Analysis;
  move: AnalysisMove;
}

/**
 * Plays a move from the position on the board. The same move as the next one of the game just steps
 * forward; any other move replaces the rest of the game. Returns null for an illegal move.
 */
export function playMove(analysis: Analysis, from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n'): PlayResult | null {
  const chess = new Chess(currentFen(analysis));
  let made;
  try {
    made = chess.move({ from: from as Square, to: to as Square, promotion });
  } catch {
    return null;
  }
  const move: AnalysisMove = {
    san: made.san,
    uci: `${made.from}${made.to}${made.promotion ?? ''}`,
    from: made.from,
    to: made.to,
    fen: chess.fen(),
    capture: Boolean(made.captured),
    check: chess.inCheck(),
  };
  const next = analysis.moves[analysis.index];
  if (next && next.uci === move.uci) {
    return { analysis: goTo(analysis, analysis.index + 1), move: next };
  }
  const moves = [...analysis.moves.slice(0, analysis.index), move];
  return { analysis: { ...analysis, moves, index: moves.length }, move };
}

export interface MoveRow {
  number: number;
  white?: { san: string; index: number };
  black?: { san: string; index: number };
}

/** The move list as rows of "1. e4 e5". A game that starts with Black to move begins with an empty White cell. */
export function moveRows(analysis: Analysis): MoveRow[] {
  const parts = analysis.startFen.trim().split(/\s+/);
  const blackFirst = parts[1] === 'b';
  const firstNumber = Math.max(1, Number(parts[5]) || 1);
  const rows: MoveRow[] = [];
  analysis.moves.forEach((move, i) => {
    const ply = i + (blackFirst ? 1 : 0);
    const number = firstNumber + Math.floor(ply / 2);
    const isWhite = ply % 2 === 0;
    let row = rows[rows.length - 1];
    if (isWhite || !row || row.number !== number) {
      row = { number };
      rows.push(row);
    }
    if (isWhite) row.white = { san: move.san, index: i + 1 };
    else row.black = { san: move.san, index: i + 1 };
  });
  return rows;
}

export interface Status {
  text: string;
  over: boolean;
}

/** What is going on at the move shown: whose turn it is, check, or how the game ended. */
export function statusAt(analysis: Analysis): Status {
  const chess = new Chess(analysis.startFen);
  for (let i = 0; i < analysis.index; i++) chess.move(analysis.moves[i].san);
  const side = chess.turn() === 'w' ? 'White' : 'Black';
  const winner = chess.turn() === 'w' ? 'Black' : 'White';
  if (chess.isCheckmate()) return { text: `Checkmate, ${winner} wins`, over: true };
  if (chess.isStalemate()) return { text: 'Stalemate, a draw', over: true };
  if (chess.isInsufficientMaterial()) return { text: 'Draw: not enough material', over: true };
  if (chess.isThreefoldRepetition()) return { text: 'Draw by threefold repetition', over: true };
  if (chess.isDrawByFiftyMoves()) return { text: 'Draw by the fifty-move rule', over: true };
  return { text: `${side} to move${chess.inCheck() ? ', in check' : ''}`, over: false };
}

export type PgnResult = { ok: true; startFen: string; moves: AnalysisMove[] } | { ok: false; error: string };

/** Moves of a game as analysis moves, played from `startFen`. */
function movesFromSans(startFen: string, sans: string[]): AnalysisMove[] {
  const chess = new Chess(startFen);
  return sans.map((san) => {
    const made = chess.move(san);
    return {
      san: made.san,
      uci: `${made.from}${made.to}${made.promotion ?? ''}`,
      from: made.from,
      to: made.to,
      fen: chess.fen(),
      capture: Boolean(made.captured),
      check: chess.inCheck(),
    };
  });
}

/** Reads a pasted PGN (the main line; comments, variations and symbols like "!?" are ignored). */
export function parsePgn(text: string): PgnResult {
  if (!text.trim()) return { ok: false, error: 'Paste a PGN first.' };
  try {
    const chess = new Chess();
    chess.loadPgn(text);
    const history = chess.history();
    const header = chess.header();
    const startFen = header.SetUp === '1' && header.FEN ? header.FEN : START_FEN;
    if (history.length === 0) return { ok: false, error: 'No moves were found in this PGN.' };
    return { ok: true, startFen, moves: movesFromSans(startFen, history) };
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : '';
    return { ok: false, error: `This PGN could not be read${reason ? `: ${reason}` : '.'}` };
  }
}

/** The game as PGN text (with the starting position in the headers when it is not the usual one). */
export function exportPgn(analysis: Analysis, title = 'Analysis'): string {
  const chess = new Chess(analysis.startFen);
  chess.setHeader('Event', title);
  for (const move of analysis.moves) chess.move(move.san);
  return chess.pgn();
}
