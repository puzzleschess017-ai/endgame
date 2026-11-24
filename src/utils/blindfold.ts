// Pure helpers for Blindfold (no React): levels, saved settings, best scores, and the checking of a
// move the player types in algebraic notation.
import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import type { Puzzle } from '../types';

/** Piece limits. 32 means "any number of pieces". */
export type BlindfoldLevel = 6 | 7 | 8 | 10 | 32;
export const BLINDFOLD_LEVELS: BlindfoldLevel[] = [6, 7, 8, 10, 32];

/** How long the position stays visible before the pieces disappear. */
export type MemorizeSeconds = 5 | 10 | 20;
export const MEMORIZE_OPTIONS: MemorizeSeconds[] = [5, 10, 20];

/** A round is this many puzzles. */
export const ROUND_SIZE = 10;

export interface BlindfoldSettings {
  level: BlindfoldLevel;
  memorize: MemorizeSeconds;
}

export const DEFAULT_BLINDFOLD_SETTINGS: BlindfoldSettings = { level: 8, memorize: 10 };

export const BLINDFOLD_SETTINGS_STORAGE_KEY = 'ctg_blindfold_settings_v1';
export const BLINDFOLD_BEST_STORAGE_KEY = 'ctg_blindfold_best_v1';

export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export function isBlindfoldLevel(value: unknown): value is BlindfoldLevel {
  return value === 6 || value === 7 || value === 8 || value === 10 || value === 32;
}

export function isMemorizeSeconds(value: unknown): value is MemorizeSeconds {
  return value === 5 || value === 10 || value === 20;
}

export function levelLabel(level: BlindfoldLevel): string {
  return level === 32 ? 'Any' : `${level}`;
}

export function levelDescription(level: BlindfoldLevel): string {
  return level === 32 ? 'any number of pieces' : `up to ${level} pieces`;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadBlindfoldSettings(): BlindfoldSettings {
  const saved = readJson(BLINDFOLD_SETTINGS_STORAGE_KEY) as Partial<BlindfoldSettings> | null;
  return {
    level: isBlindfoldLevel(saved?.level) ? saved.level : DEFAULT_BLINDFOLD_SETTINGS.level,
    memorize: isMemorizeSeconds(saved?.memorize) ? saved.memorize : DEFAULT_BLINDFOLD_SETTINGS.memorize,
  };
}

export function saveBlindfoldSettings(settings: BlindfoldSettings): void {
  try {
    localStorage.setItem(BLINDFOLD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

/** Best number of correct answers in a round (out of ROUND_SIZE) for this level, 0 if none. */
export function loadBlindfoldBest(level: BlindfoldLevel): number {
  const parsed = readJson(BLINDFOLD_BEST_STORAGE_KEY);
  const value = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[String(level)] : 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function saveBlindfoldBest(
  level: BlindfoldLevel,
  correct: number,
): { best: number; isNewBest: boolean } {
  const previous = loadBlindfoldBest(level);
  if (correct <= 0 || correct <= previous) return { best: previous, isNewBest: false };
  try {
    const parsed = readJson(BLINDFOLD_BEST_STORAGE_KEY);
    const all = parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
    all[String(level)] = Math.floor(correct);
    localStorage.setItem(BLINDFOLD_BEST_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return { best: Math.floor(correct), isNewBest: true };
}

export interface BlindfoldPosition {
  /** Position after the opponent's move: the one to memorize. */
  fen: string;
  /** The opponent's move that was just played. */
  lastMove: [Key, Key];
  /** The side that has to deliver mate (and the way the board is turned). */
  playerColor: 'white' | 'black';
  mateUci: string;
  mateSan: string;
  pieceCount: number;
}

function uciParts(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

/** Plays the opponent's first move and works out the mating move. Null if the puzzle is unusable. */
export function preparePosition(puzzle: Pick<Puzzle, 'fen' | 'moves'>): BlindfoldPosition | null {
  if (puzzle.moves.length !== 2) return null;
  try {
    const game = new Chess(puzzle.fen);
    const setup = uciParts(puzzle.moves[0]);
    game.move({ from: setup.from, to: setup.to, promotion: setup.promotion });
    const fen = game.fen();
    const playerColor = game.turn() === 'w' ? 'white' : 'black';
    const mate = uciParts(puzzle.moves[1]);
    const mated = new Chess(fen);
    const move = mated.move({ from: mate.from, to: mate.to, promotion: mate.promotion });
    if (!mated.isCheckmate()) return null;
    return {
      fen,
      lastMove: [setup.from as Key, setup.to as Key],
      playerColor,
      mateUci: puzzle.moves[1],
      mateSan: move.san,
      pieceCount: fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length,
    };
  } catch {
    return null;
  }
}

export type AnswerResult =
  | { kind: 'empty' }
  /** Not a legal move in this position (or not readable as a move): the player may try again. */
  | { kind: 'illegal' }
  | { kind: 'wrong'; san: string }
  | { kind: 'correct'; san: string };

/** Typed text -> things chess.js can read (it is strict about capital letters and symbols). */
function answerCandidates(text: string): string[] {
  let cleaned = text.replace(/[+#!?\s]/g, '');
  if (/^[0oO]-[0oO](-[0oO])?$/.test(cleaned)) cleaned = cleaned.replace(/[0o]/g, 'O');
  const candidates = [cleaned];
  // Promotion typed with a small letter or without "=": a8q, a8=q, axb8n
  const promotion = /^([a-h](?:x[a-h])?[18])=?([qrbnQRBN])$/.exec(cleaned);
  if (promotion) candidates.push(`${promotion[1]}=${promotion[2].toUpperCase()}`);
  // Piece typed with a small letter: qh7, nf3 (a pawn capture like bxc4 is tried as typed first)
  if (/^[nbrqk]/.test(cleaned) && cleaned.length >= 3) {
    candidates.push(cleaned[0].toUpperCase() + cleaned.slice(1));
  }
  return candidates;
}

/**
 * Checks the typed move in the position the puzzle asks about. Any legal move that checkmates is
 * correct (some puzzles have more than one mate). "+", "#" and "!" are optional.
 */
export function checkAnswer(fen: string, text: string): AnswerResult {
  if (!text.trim()) return { kind: 'empty' };
  for (const candidate of answerCandidates(text)) {
    if (!candidate) continue;
    try {
      const game = new Chess(fen);
      const move = game.move(candidate, { strict: false });
      return game.isCheckmate() ? { kind: 'correct', san: move.san } : { kind: 'wrong', san: move.san };
    } catch {
      // not readable this way, try the next spelling
    }
  }
  return { kind: 'illegal' };
}

export interface BlindfoldItem {
  puzzle: Puzzle;
  position: BlindfoldPosition;
}

/** Asks the server for a round of mate-in-1 puzzles and prepares each position. */
export async function fetchBlindfoldRound(
  level: BlindfoldLevel,
  count: number = ROUND_SIZE,
  fetchImpl: typeof fetch = fetch,
): Promise<BlindfoldItem[]> {
  const response = await fetchImpl(`/api/puzzles/blindfold?maxPieces=${level}&count=${count}`);
  if (!response.ok) {
    let message = `Could not load puzzles (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  const body = (await response.json()) as { puzzles?: Puzzle[] };
  const items: BlindfoldItem[] = [];
  for (const puzzle of Array.isArray(body.puzzles) ? body.puzzles : []) {
    const position = preparePosition(puzzle);
    if (position) items.push({ puzzle, position });
  }
  if (items.length === 0) throw new Error('No usable puzzles came back. Please try again.');
  return items;
}
