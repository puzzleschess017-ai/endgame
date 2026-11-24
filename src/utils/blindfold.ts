// Pure helpers for Blindfold (no React): levels, saved settings, best scores, and the checking of a
// move the player types in algebraic notation.
import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import type { Puzzle } from '../types';

/** Piece limits. 32 means "any number of pieces". */
export type BlindfoldLevel = 6 | 7 | 8 | 10 | 32;
export const BLINDFOLD_LEVELS: BlindfoldLevel[] = [6, 7, 8, 10, 32];

/** How many moves the mate takes (the player's own moves, the last one gives checkmate). */
export type MateIn = 1 | 2 | 3;
export const MATE_IN_OPTIONS: MateIn[] = [1, 2, 3];

export function isMateIn(value: unknown): value is MateIn {
  return value === 1 || value === 2 || value === 3;
}

/** How long the position stays visible before the pieces disappear. */
export type MemorizeSeconds = 5 | 10 | 20;
export const MEMORIZE_OPTIONS: MemorizeSeconds[] = [5, 10, 20];

/** A round is this many puzzles. */
export const ROUND_SIZE = 10;

export interface BlindfoldSettings {
  level: BlindfoldLevel;
  memorize: MemorizeSeconds;
  mateIn: MateIn;
}

export const DEFAULT_BLINDFOLD_SETTINGS: BlindfoldSettings = { level: 8, memorize: 10, mateIn: 1 };

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
    mateIn: isMateIn(saved?.mateIn) ? saved.mateIn : DEFAULT_BLINDFOLD_SETTINGS.mateIn,
  };
}

export function saveBlindfoldSettings(settings: BlindfoldSettings): void {
  try {
    localStorage.setItem(BLINDFOLD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

/**
 * Where a best score is kept in the saved map. Mate in 1 keeps its old keys ("8"), so records made before
 * mate in 2 and 3 existed still count; the others are "2:8" and "3:8".
 */
export function bestKey(level: BlindfoldLevel, mateIn: MateIn = 1): string {
  return mateIn === 1 ? String(level) : `${mateIn}:${level}`;
}

/** Best number of correct answers in a round (out of ROUND_SIZE) for this level, 0 if none. */
export function loadBlindfoldBest(level: BlindfoldLevel, mateIn: MateIn = 1): number {
  const parsed = readJson(BLINDFOLD_BEST_STORAGE_KEY);
  const value = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[bestKey(level, mateIn)] : 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function saveBlindfoldBest(
  level: BlindfoldLevel,
  correct: number,
  mateIn: MateIn = 1,
): { best: number; isNewBest: boolean } {
  const previous = loadBlindfoldBest(level, mateIn);
  if (correct <= 0 || correct <= previous) return { best: previous, isNewBest: false };
  try {
    const parsed = readJson(BLINDFOLD_BEST_STORAGE_KEY);
    const all = parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
    all[bestKey(level, mateIn)] = Math.floor(correct);
    localStorage.setItem(BLINDFOLD_BEST_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return { best: Math.floor(correct), isNewBest: true };
}

/** One move of the solution after the opponent's first move: the position it is played in, and the move. */
export interface SolutionPly {
  fenBefore: string;
  uci: string;
  san: string;
  /** True for the player's moves, false for the opponent's replies. */
  byPlayer: boolean;
}

export interface BlindfoldPosition {
  /** Position after the opponent's move: the one to memorize. */
  fen: string;
  /** The opponent's move that was just played. */
  lastMove: [Key, Key];
  /** The side that has to deliver mate (and the way the board is turned). */
  playerColor: 'white' | 'black';
  /** How many moves the player needs (1, 2 or 3). */
  mateIn: MateIn;
  /** The whole solution: the player's move, the opponent's reply, ... and the checkmate last. */
  solution: SolutionPly[];
  /** The final checkmate (the same as the last move of the solution). */
  mateUci: string;
  mateSan: string;
  pieceCount: number;
}

function uciParts(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

/**
 * Plays the opponent's first move and works out the solution (mate in 1, 2 or 3, from the number of moves in
 * the puzzle). Null if the puzzle is unusable: a move that is not legal, or a line that does not end in mate.
 */
export function preparePosition(puzzle: Pick<Puzzle, 'fen' | 'moves'>): BlindfoldPosition | null {
  const plies = puzzle.moves.length;
  if (plies !== 2 && plies !== 4 && plies !== 6) return null;
  const mateIn = (plies / 2) as MateIn;
  try {
    const game = new Chess(puzzle.fen);
    const setup = uciParts(puzzle.moves[0]);
    game.move({ from: setup.from, to: setup.to, promotion: setup.promotion });
    const fen = game.fen();
    const playerColor = game.turn() === 'w' ? 'white' : 'black';
    const solution: SolutionPly[] = [];
    puzzle.moves.slice(1).forEach((uci, i) => {
      const part = uciParts(uci);
      const fenBefore = game.fen();
      const move = game.move({ from: part.from, to: part.to, promotion: part.promotion });
      solution.push({ fenBefore, uci, san: move.san, byPlayer: i % 2 === 0 });
    });
    if (!game.isCheckmate()) return null;
    const mate = solution[solution.length - 1];
    return {
      fen,
      lastMove: [setup.from as Key, setup.to as Key],
      playerColor,
      mateIn,
      solution,
      mateUci: mate.uci,
      mateSan: mate.san,
      pieceCount: fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length,
    };
  } catch {
    return null;
  }
}

/** What the player faces on move number `step` (0 is the first): the position, the move just made, the wanted move. */
export function stepView(position: BlindfoldPosition, step: number): {
  fen: string;
  lastMove: [Key, Key];
  expectedUci: string;
  isLast: boolean;
} {
  const own = position.solution[step * 2];
  const before = step === 0 ? null : position.solution[step * 2 - 1];
  return {
    fen: own.fenBefore,
    lastMove: before
      ? [before.uci.slice(0, 2) as Key, before.uci.slice(2, 4) as Key]
      : position.lastMove,
    expectedUci: own.uci,
    isLast: step === position.mateIn - 1,
  };
}

/** The solution as one line of moves, e.g. "Qh7+ Kg8 Qxg7#". */
export function solutionLine(position: BlindfoldPosition): string {
  return position.solution.map((ply) => ply.san).join(' ');
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

/** The typed move played in `fen`, or null when it is not readable or not legal there. */
function playTyped(fen: string, text: string): { game: Chess; san: string; uci: string } | null {
  for (const candidate of answerCandidates(text)) {
    if (!candidate) continue;
    try {
      const game = new Chess(fen);
      const move = game.move(candidate, { strict: false });
      return { game, san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ''}` };
    } catch {
      // not readable this way, try the next spelling
    }
  }
  return null;
}

/**
 * Checks the typed move in the position the puzzle asks about (mate in 1). Any legal move that checkmates
 * is correct (some puzzles have more than one mate). "+", "#" and "!" are optional.
 */
export function checkAnswer(fen: string, text: string): AnswerResult {
  if (!text.trim()) return { kind: 'empty' };
  const played = playTyped(fen, text);
  if (!played) return { kind: 'illegal' };
  return played.game.isCheckmate() ? { kind: 'correct', san: played.san } : { kind: 'wrong', san: played.san };
}

export type StepResult =
  | { kind: 'empty' }
  | { kind: 'illegal' }
  /** Legal, but neither the move of the puzzle nor a checkmate. */
  | { kind: 'wrong'; san: string }
  /** The wanted move, and the game goes on. */
  | { kind: 'continue'; san: string }
  /** Checkmate: the puzzle is solved. */
  | { kind: 'mate'; san: string };

/**
 * Checks one move of a longer mate. Checkmate always solves the puzzle (even one move early, or a second
 * mating move); before that only the move of the puzzle goes on, like on Lichess.
 */
export function checkStep(fen: string, text: string, expectedUci: string): StepResult {
  if (!text.trim()) return { kind: 'empty' };
  const played = playTyped(fen, text);
  if (!played) return { kind: 'illegal' };
  if (played.game.isCheckmate()) return { kind: 'mate', san: played.san };
  return played.uci === expectedUci ? { kind: 'continue', san: played.san } : { kind: 'wrong', san: played.san };
}

export interface BlindfoldItem {
  puzzle: Puzzle;
  position: BlindfoldPosition;
}

/** Asks the server for a round of mate-in-1 (or 2, or 3) puzzles and prepares each position. */
export async function fetchBlindfoldRound(
  level: BlindfoldLevel,
  count: number = ROUND_SIZE,
  fetchImpl: typeof fetch = fetch,
  headers: Record<string, string> = {},
  mateIn: MateIn = 1,
): Promise<BlindfoldItem[]> {
  const extra = mateIn === 1 ? '' : `&mateIn=${mateIn}`;
  const response = await fetchImpl(`/api/puzzles/blindfold?maxPieces=${level}&count=${count}${extra}`, { headers });
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
    if (position && position.mateIn === mateIn) items.push({ puzzle, position });
  }
  if (items.length === 0) throw new Error('No usable puzzles came back. Please try again.');
  return items;
}
