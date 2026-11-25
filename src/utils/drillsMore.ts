// Question makers for the newer Blindfold drills (no React): attacked or not, moves needed, count the squares,
// square and opposition, follow the moves. `drills.ts` holds the older drills and hands these kinds to this file.
// Everything here is plain chess geometry (plus chess.js for "follow the moves"), so it is tested on its own.
import { Chess, type Move } from 'chess.js';
import type { DrillOption, DrillQuestion } from './drills.ts';

type Rng = () => number;
export type Colour = 'white' | 'black';
export type PieceName = 'knight' | 'bishop' | 'rook' | 'queen' | 'king' | 'pawn';

const FILES = 'abcdefgh';

function fileOf(square: string): number {
  return FILES.indexOf(square[0]);
}

function rankOf(square: string): number {
  return Number(square[1]) - 1;
}

function squareAt(file: number, rank: number): string {
  return `${FILES[file]}${rank + 1}`;
}

function inside(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

const ALL_SQUARES: string[] = [];
for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) ALL_SQUARES.push(squareAt(f, r));

function randomInt(rng: Rng, max: number): number {
  return Math.min(max - 1, Math.floor(rng() * max));
}

function pickFrom<T>(rng: Rng, list: T[]): T {
  return list[randomInt(rng, list.length)];
}

function randomSquare(rng: Rng): string {
  return pickFrom(rng, ALL_SQUARES);
}

function otherColour(side: Colour): Colour {
  return side === 'white' ? 'black' : 'white';
}

function capital(text: string): string {
  return text[0].toUpperCase() + text.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function isLight(square: string): boolean {
  return (fileOf(square) + rankOf(square)) % 2 === 1;
}

/** A button for a number (its key is the digit). */
function numberOption(n: number): DrillOption {
  return { label: String(n), value: String(n), key: String(n) };
}

const YES_NO: DrillOption[] = [
  { label: 'Yes', value: 'yes', key: 'y' },
  { label: 'No', value: 'no', key: 'n' },
];

// ---- Attacks -------------------------------------------------------------------------------------------------

const STEP_KING: Array<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/**
 * True when `piece` of colour `side` on `from` attacks `target` (the square may be empty or hold anything). `blockers`
 * are squares of other pieces: a bishop, rook or queen cannot see past them (it does attack the blocker's own
 * square). Pawns attack one step forward diagonally: white up the board, black down.
 */
export function attacks(piece: PieceName, side: Colour, from: string, target: string, blockers: string[] = []): boolean {
  if (from === target) return false;
  const df = fileOf(target) - fileOf(from);
  const dr = rankOf(target) - rankOf(from);
  switch (piece) {
    case 'knight':
      return (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
    case 'king':
      return Math.max(Math.abs(df), Math.abs(dr)) === 1;
    case 'pawn':
      return Math.abs(df) === 1 && dr === (side === 'white' ? 1 : -1);
    default: {
      const straight = df === 0 || dr === 0;
      const diagonal = Math.abs(df) === Math.abs(dr);
      if (piece === 'rook' && !straight) return false;
      if (piece === 'bishop' && !diagonal) return false;
      if (!straight && !diagonal) return false;
      return between(from, target).every((square) => !blockers.includes(square));
    }
  }
}

/** Squares strictly between two squares on one line (empty when they are not on a line, or are neighbours). */
export function between(a: string, b: string): string[] {
  const df = fileOf(b) - fileOf(a);
  const dr = rankOf(b) - rankOf(a);
  if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return [];
  const n = Math.max(Math.abs(df), Math.abs(dr));
  const out: string[] = [];
  for (let i = 1; i < n; i++) out.push(squareAt(fileOf(a) + Math.sign(df) * i, rankOf(a) + Math.sign(dr) * i));
  return out;
}

/** Every square the piece attacks from `from` (with `blockers` in the way). */
export function attackedSquares(piece: PieceName, side: Colour, from: string, blockers: string[] = []): string[] {
  return ALL_SQUARES.filter((square) => attacks(piece, side, from, square, blockers));
}

/** A piece standing somewhere on the board, named in the question. */
interface Placed {
  name: PieceName;
  side: Colour;
  square: string;
}

const BLOCKER_NAMES: PieceName[] = ['pawn', 'knight', 'bishop', 'rook', 'queen'];

function makeBlocker(rng: Rng, square: string): Placed {
  let name = pickFrom(rng, BLOCKER_NAMES);
  if (name === 'pawn' && (rankOf(square) === 0 || rankOf(square) === 7)) name = 'knight';
  return { name, side: rng() < 0.5 ? 'white' : 'black', square };
}

function placedText(p: Placed): string {
  return `${p.side} ${p.name} on ${p.square}`;
}

const ATTACKERS: PieceName[] = ['knight', 'bishop', 'rook', 'queen', 'king', 'pawn', 'knight', 'bishop', 'rook', 'queen'];

/** "Does the bishop on b3 attack d5?" (sometimes with a piece in the way) or "Does the knight on e5 attack both c6 and g6?" */
export function buildAttackQuestion(rng: Rng): DrillQuestion {
  const piece = pickFrom(rng, ATTACKERS);
  const side: Colour = rng() < 0.5 ? 'white' : 'black';
  // A pawn never stands on the first or last rank.
  let from: string;
  do from = randomSquare(rng);
  while (piece === 'pawn' && (rankOf(from) === 0 || rankOf(from) === 7));
  const slides = piece === 'bishop' || piece === 'rook' || piece === 'queen';
  const reached = attackedSquares(piece, side, from);
  const missed = ALL_SQUARES.filter((square) => square !== from && !reached.includes(square));
  const head = `${capital(side)} ${piece} on ${from}`;

  if (rng() < 0.4) {
    // Two squares at once: yes only when both are attacked.
    let a: string;
    let b: string;
    if (reached.length >= 2 && rng() < 0.5) {
      a = pickFrom(rng, reached);
      do b = pickFrom(rng, reached);
      while (b === a);
    } else if (rng() < 0.7) {
      a = pickFrom(rng, reached);
      b = pickFrom(rng, missed);
    } else {
      a = pickFrom(rng, missed);
      do b = pickFrom(rng, missed);
      while (b === a);
    }
    if (rng() < 0.5) [a, b] = [b, a];
    const hitA = attacks(piece, side, from, a);
    const hitB = attacks(piece, side, from, b);
    const both = hitA && hitB;
    const explanation = both
      ? `Yes, the ${piece} on ${from} attacks ${a} and ${b}.`
      : hitA || hitB
        ? `No, the ${piece} on ${from} attacks ${hitA ? a : b} but not ${hitA ? b : a}.`
        : `No, the ${piece} on ${from} attacks neither ${a} nor ${b}.`;
    return {
      kind: 'attack',
      prompt: `${head}. Does the ${piece} attack both ${a} and ${b}?`,
      squares: [from, a, b],
      options: YES_NO,
      answer: both ? 'yes' : 'no',
      explanation,
    };
  }

  let target: string;
  let blockers: Placed[] = [];
  if (rng() < 0.5) {
    target = pickFrom(rng, reached);
    // Sometimes a piece stands off the line: it blocks nothing.
    if (slides && rng() < 0.3) {
      const line = between(from, target);
      let square: string;
      let guard = 0;
      do square = randomSquare(rng);
      while ((square === from || square === target || line.includes(square)) && ++guard < 30);
      if (guard < 30) blockers = [makeBlocker(rng, square)];
    }
  } else {
    // A square on the line, but with a piece in between, makes the best "no".
    const farther = reached.filter((square) => between(from, square).length > 0);
    if (slides && farther.length > 0 && rng() < 0.45) {
      target = pickFrom(rng, farther);
      blockers = [makeBlocker(rng, pickFrom(rng, between(from, target)))];
    } else {
      target = pickFrom(rng, missed);
    }
  }
  const hit = attacks(piece, side, from, target, blockers.map((b) => b.square));
  const text = [head, ...blockers.map(placedText)].join(', ');
  const explanation = hit
    ? `Yes, the ${piece} on ${from} attacks ${target}.`
    : blockers.length > 0 && attacks(piece, side, from, target)
      ? `No, the ${blockers[0].name} on ${blockers[0].square} is in the way.`
      : `No, the ${piece} on ${from} does not attack ${target}.`;
  return {
    kind: 'attack',
    prompt: `${text}. Does the ${piece} attack ${target}?`,
    squares: [from, target, ...blockers.map((b) => b.square)],
    options: YES_NO,
    answer: hit ? 'yes' : 'no',
    explanation,
  };
}

// ---- Moves needed (king, rook, bishop) -----------------------------------------------------------------------

export type Walker = 'king' | 'rook' | 'bishop';

/** Fewest moves for a lone piece on an empty board: 0 for the same square, -1 when it can never get there. */
export function movesNeeded(piece: Walker, from: string, to: string): number {
  if (from === to) return 0;
  const df = Math.abs(fileOf(to) - fileOf(from));
  const dr = Math.abs(rankOf(to) - rankOf(from));
  switch (piece) {
    case 'king':
      return Math.max(df, dr);
    case 'rook':
      return df === 0 || dr === 0 ? 1 : 2;
    case 'bishop':
      if (isLight(from) !== isLight(to)) return -1;
      return df === dr ? 1 : 2;
  }
}

const KING_OPTIONS: DrillOption[] = [1, 2, 3, 4, 5, 6, 7].map(numberOption);
const ROOK_OPTIONS: DrillOption[] = [1, 2].map(numberOption);
const BISHOP_OPTIONS: DrillOption[] = [...[1, 2].map(numberOption), { label: 'Impossible', value: 'never', key: 'x' }];

/** "How many moves does a bishop need from c1 to f6?" (a bishop never changes colour: some trips are impossible). */
export function buildDistanceQuestion(rng: Rng): DrillQuestion {
  const piece = pickFrom<Walker>(rng, ['king', 'king', 'rook', 'rook', 'bishop', 'bishop', 'bishop']);
  const from = randomSquare(rng);
  let to = from;
  while (to === from) {
    if (piece === 'bishop') {
      // About one trip in five is impossible: the other square has the other colour.
      const wantImpossible = rng() < 0.2;
      to = pickFrom(rng, ALL_SQUARES.filter((s) => s !== from && (isLight(s) !== isLight(from)) === wantImpossible));
    } else if (piece === 'rook' && rng() < 0.45) {
      // Often on one line: that is the answer 1.
      to = rng() < 0.5 ? squareAt(fileOf(from), randomInt(rng, 8)) : squareAt(randomInt(rng, 8), rankOf(from));
    } else {
      to = randomSquare(rng);
    }
  }
  const moves = movesNeeded(piece, from, to);
  const df = Math.abs(fileOf(to) - fileOf(from));
  const dr = Math.abs(rankOf(to) - rankOf(from));
  let explanation: string;
  if (piece === 'king') {
    explanation = `A king needs ${plural(moves, 'move', 'moves')}: the bigger gap is ${Math.max(df, dr)} ${df >= dr ? 'files' : 'ranks'}.`;
  } else if (piece === 'rook') {
    explanation =
      moves === 1
        ? `The rook goes along the ${df === 0 ? 'file' : 'rank'}: 1 move.`
        : `Not on one line: 2 moves, for example via ${squareAt(fileOf(from), rankOf(to))}.`;
  } else if (moves === -1) {
    explanation = `A bishop keeps its colour: ${from} is ${isLight(from) ? 'light' : 'dark'}, ${to} is ${isLight(to) ? 'light' : 'dark'}.`;
  } else if (moves === 1) {
    explanation = `${from} and ${to} share a diagonal: 1 move.`;
  } else {
    const via = ALL_SQUARES.find((s) => attacks('bishop', 'white', from, s) && attacks('bishop', 'white', s, to));
    explanation = `Not on one diagonal: 2 moves, for example via ${via}.`;
  }
  return {
    kind: 'distance',
    prompt: `How many moves does a ${piece} need from ${from} to ${to}?`,
    squares: [from, to],
    options: piece === 'king' ? KING_OPTIONS : piece === 'rook' ? ROOK_OPTIONS : BISHOP_OPTIONS,
    answer: moves === -1 ? 'never' : String(moves),
    explanation,
  };
}

// ---- Count the squares ---------------------------------------------------------------------------------------

export type Counted = 'knight' | 'bishop' | 'queen' | 'king';

/** The squares a piece attacks from `from` on an empty board. */
export function squaresAttackedOnEmptyBoard(piece: Counted, from: string): string[] {
  if (piece === 'queen') {
    return ALL_SQUARES.filter((s) => attacks('rook', 'white', from, s) || attacks('bishop', 'white', from, s));
  }
  return attackedSquares(piece, 'white', from);
}

/** "How many squares does a knight on e4 attack?" or "How many squares lie between a1 and h8?" (typed answers). */
export function buildCountQuestion(rng: Rng): DrillQuestion {
  if (rng() < 0.3) {
    // Two squares on one line, not neighbours.
    const a = randomSquare(rng);
    const b = pickFrom(rng, ALL_SQUARES.filter((s) => between(a, s).length > 0));
    const squares = between(a, b);
    return {
      kind: 'count',
      prompt: `How many squares lie between ${a} and ${b}?`,
      squares: [a, b],
      options: [],
      entry: 'number',
      answer: String(squares.length),
      explanation: `Between ${a} and ${b}: ${squares.join(', ')} = ${squares.length}.`,
    };
  }
  const piece = pickFrom<Counted>(rng, ['knight', 'knight', 'knight', 'bishop', 'bishop', 'queen', 'king']);
  const from = randomSquare(rng);
  const reached = squaresAttackedOnEmptyBoard(piece, from);
  let explanation: string;
  if (piece === 'knight' || piece === 'king') {
    explanation = `A ${piece} on ${from} attacks ${reached.length}: ${reached.join(', ')}.`;
  } else if (piece === 'queen') {
    const diagonals = attackedSquares('bishop', 'white', from).length;
    explanation = `A queen on ${from} attacks ${reached.length}: 14 along the file and rank plus ${diagonals} on the diagonals.`;
  } else {
    explanation = `A bishop on ${from} attacks ${reached.length} squares.`;
  }
  return {
    kind: 'count',
    prompt: `On an empty board, how many squares does a ${piece} on ${from} attack?`,
    squares: [from],
    options: [],
    entry: 'number',
    answer: String(reached.length),
    explanation,
  };
}

// ---- Rule of the square and opposition -----------------------------------------------------------------------

/** Moves a pawn on `rankIndex` (0-based, from its own side) needs to queen: a pawn on its first step may jump two. */
function pawnMovesToQueen(rankIndex: number): number {
  return 7 - Math.max(rankIndex, 2);
}

/** Moves the king needs to reach the pawn's queening square. */
function kingMovesToQueeningSquare(pawn: string, pawnSide: Colour, king: string): number {
  const promotionRank = pawnSide === 'white' ? 7 : 0;
  return Math.max(Math.abs(fileOf(king) - fileOf(pawn)), Math.abs(rankOf(king) - promotionRank));
}

/** A pawn's rank counted from its own side (0 = its first rank). */
function ownRank(pawn: string, pawnSide: Colour): number {
  return pawnSide === 'white' ? rankOf(pawn) : 7 - rankOf(pawn);
}

/**
 * The rule of the square for a lone pawn against a lone king: does the king catch the pawn? With the pawn to move the
 * king must be inside the square of the pawn's run, with the king to move it may be one step farther out.
 */
export function kingCatchesPawn(pawn: string, pawnSide: Colour, king: string, pawnToMove: boolean): boolean {
  const run = pawnMovesToQueen(ownRank(pawn, pawnSide));
  const reach = kingMovesToQueeningSquare(pawn, pawnSide, king);
  return pawnToMove ? reach <= run : reach <= run + 1;
}

export type Holder = 'white' | 'black' | 'none';

/**
 * Who has the opposition. The kings stand on one file or rank with an odd number of squares between them (1 is the
 * direct opposition, 3 and 5 the distant one) and the side that is NOT to move has it. Otherwise nobody has it.
 */
export function oppositionHolder(white: string, black: string, whiteToMove: boolean): Holder {
  const df = Math.abs(fileOf(white) - fileOf(black));
  const dr = Math.abs(rankOf(white) - rankOf(black));
  const aligned = df === 0 || dr === 0;
  const gap = Math.max(df, dr);
  if (!aligned || gap < 2 || gap % 2 !== 0) return 'none';
  return whiteToMove ? 'black' : 'white';
}

const HOLDER_OPTIONS: DrillOption[] = [
  { label: 'White', value: 'white', key: 'w' },
  { label: 'Black', value: 'black', key: 'b' },
  { label: 'Nobody', value: 'none', key: 'n' },
];

function chebyshev(a: string, b: string): number {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
}

function buildSquareQuestion(rng: Rng): DrillQuestion {
  const pawnSide: Colour = rng() < 0.5 ? 'white' : 'black';
  // The pawn stands between its 2nd and 6th rank (on the 7th the question is too easy).
  const ownIndex = 1 + randomInt(rng, 5);
  const pawn = squareAt(randomInt(rng, 8), pawnSide === 'white' ? ownIndex : 7 - ownIndex);
  const pawnToMove = rng() < 0.5;
  const run = pawnMovesToQueen(ownRank(pawn, pawnSide));
  const limit = pawnToMove ? run : run + 1;
  const wantCatch = rng() < 0.5;
  // Near the edge of the square makes the interesting questions; the rest are filled with any square.
  const candidates = ALL_SQUARES.filter((s) => chebyshev(s, pawn) >= 2);
  const fits = candidates.filter((s) => (kingMovesToQueeningSquare(pawn, pawnSide, s) <= limit) === wantCatch);
  const near = fits.filter((s) => Math.abs(kingMovesToQueeningSquare(pawn, pawnSide, s) - limit) <= 1);
  const pool = near.length > 0 && rng() < 0.75 ? near : fits.length > 0 ? fits : candidates;
  const king = pickFrom(rng, pool);
  const catches = kingCatchesPawn(pawn, pawnSide, king, pawnToMove);
  const promotion = squareAt(fileOf(pawn), pawnSide === 'white' ? 7 : 0);
  const kingSide = otherColour(pawnSide);
  const reach = kingMovesToQueeningSquare(pawn, pawnSide, king);
  const first = pawnToMove ? 'the pawn moves first' : 'the king moves first';
  const explanation = catches
    ? `Yes: the pawn needs ${run} to reach ${promotion}, the king ${reach}, and ${first}, so the king is in time.`
    : `No: the pawn needs ${run} to reach ${promotion}, the king ${reach}, and ${first}, so the king is too late.`;
  return {
    kind: 'endgame',
    prompt: `${capital(pawnSide)} pawn on ${pawn}, ${kingSide} king on ${king}, ${pawnToMove ? pawnSide : kingSide} to move. Does the king catch the pawn?`,
    squares: [pawn, king],
    options: YES_NO,
    answer: catches ? 'yes' : 'no',
    explanation,
  };
}

function buildOppositionQuestion(rng: Rng): DrillQuestion {
  const whiteToMove = rng() < 0.5;
  let white: string;
  let black: string;
  const roll = rng();
  do {
    white = randomSquare(rng);
    if (roll < 0.7) {
      // On one file or rank at an even distance: somebody has the opposition.
      const gap = pickFrom(rng, [2, 2, 2, 4, 4, 6]);
      const vertical = rng() < 0.5;
      const sign = rng() < 0.5 ? 1 : -1;
      const f = fileOf(white) + (vertical ? 0 : sign * gap);
      const r = rankOf(white) + (vertical ? sign * gap : 0);
      black = inside(f, r) ? squareAt(f, r) : white;
    } else if (roll < 0.85) {
      // On one file or rank, but an even number of squares between: nobody has it.
      const gap = pickFrom(rng, [3, 5, 7]);
      const vertical = rng() < 0.5;
      const sign = rng() < 0.5 ? 1 : -1;
      const f = fileOf(white) + (vertical ? 0 : sign * gap);
      const r = rankOf(white) + (vertical ? sign * gap : 0);
      black = inside(f, r) ? squareAt(f, r) : white;
    } else {
      black = randomSquare(rng);
    }
  } while (white === black || chebyshev(white, black) < 2);
  const holder = oppositionHolder(white, black, whiteToMove);
  const gap = chebyshev(white, black);
  const line = fileOf(white) === fileOf(black) ? `the ${white[0]}-file` : rankOf(white) === rankOf(black) ? `rank ${white[1]}` : '';
  let explanation: string;
  if (holder === 'none') {
    explanation = line
      ? `Nobody: on ${line} the squares between the kings are ${gap - 1}, an even number, so there is no opposition.`
      : 'Nobody: the kings are not on one file or rank.';
  } else {
    explanation = `${capital(holder)} has it: the kings face each other on ${line} with ${plural(gap - 1, 'square', 'squares')} between, and the side not to move has the opposition.`;
  }
  return {
    kind: 'endgame',
    prompt: `White king on ${white}, black king on ${black}, ${whiteToMove ? 'white' : 'black'} to move. Who has the opposition?`,
    squares: [white, black],
    options: HOLDER_OPTIONS,
    answer: holder,
    explanation,
  };
}

/** Rule of the square or opposition, half and half. */
export function buildEndgameQuestion(rng: Rng): DrillQuestion {
  return rng() < 0.5 ? buildSquareQuestion(rng) : buildOppositionQuestion(rng);
}

// ---- Follow the moves ----------------------------------------------------------------------------------------

const PIECE_WORD: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

const WHAT_OPTIONS: DrillOption[] = [
  { label: 'Pawn', value: 'pawn', key: 'p' },
  { label: 'Knight', value: 'knight', key: 'n' },
  { label: 'Bishop', value: 'bishop', key: 'b' },
  { label: 'Rook', value: 'rook', key: 'r' },
  { label: 'Queen', value: 'queen', key: 'q' },
  { label: 'King', value: 'king', key: 'k' },
  { label: 'Empty', value: 'empty', key: 'e' },
];

/** Plausible moves come more often than strange ones: centre pawns, knights and bishops, captures, castling. */
function moveWeight(move: Move): number {
  let weight: number;
  if (move.flags.includes('k') || move.flags.includes('q')) weight = 3;
  else if (move.piece === 'p') weight = 'cdef'.includes(move.from[0]) ? 4 : 1.5;
  else if (move.piece === 'n') weight = 4;
  else if (move.piece === 'b') weight = 3;
  else if (move.piece === 'q') weight = 1;
  else if (move.piece === 'r') weight = 0.5;
  else weight = 0.2;
  return move.captured ? weight * 2.5 : weight;
}

function pickMove(rng: Rng, moves: Move[]): Move {
  const total = moves.reduce((sum, m) => sum + moveWeight(m), 0);
  let roll = rng() * total;
  for (const move of moves) {
    roll -= moveWeight(move);
    if (roll < 0) return move;
  }
  return moves[moves.length - 1];
}

/** "1.e4 e5 2.Nf3 Nc6 3.Bb5" */
export function movesText(sans: string[]): string {
  return sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ');
}

/** The result of a made-up game, with the facts the questions are made from. */
export interface FollowGame {
  /** The moves in algebraic notation, from the starting position. */
  sans: string[];
  /** The final position (a chess.js game, so it can answer "what is on e5?"). */
  game: Chess;
  /** Where every piece that started the game on `origin` is now (null: it was captured). */
  where: Record<string, string | null>;
  /** Squares that a move started from or arrived on. */
  touched: string[];
}

/** Where every piece that started on a square is after these moves, and which squares the moves touched. */
export function followPieces(moves: Move[]): Pick<FollowGame, 'where' | 'touched'> {
  const where: Record<string, string | null> = {};
  for (const s of new Chess().board().flat()) if (s) where[s.square] = s.square;
  const touched = new Set<string>();
  const current = (square: string) => Object.keys(where).find((origin) => where[origin] === square);
  for (const move of moves) {
    // Whoever stands on `from` goes to `to`; whoever stands on `to` (or is taken en passant) is gone.
    if (move.captured) {
      const taken = current(move.flags.includes('e') ? squareAt(fileOf(move.to), rankOf(move.from)) : move.to);
      if (taken) where[taken] = null;
    }
    const mover = current(move.from);
    if (mover) where[mover] = move.to;
    if (move.flags.includes('k') || move.flags.includes('q')) {
      const rank = move.color === 'w' ? '1' : '8';
      const [rookFrom, rookTo] = move.flags.includes('k') ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`];
      const rook = current(rookFrom);
      if (rook) where[rook] = rookTo;
      touched.add(rookFrom);
      touched.add(rookTo);
    }
    touched.add(move.from);
    touched.add(move.to);
  }
  return { where, touched: [...touched] };
}

function play(game: Chess, move: Move): Move {
  return game.move({ from: move.from, to: move.to, promotion: move.promotion });
}

/** New games tried when a check is wanted (a position rarely allows one), and second-to-last moves tried in each. */
const ATTEMPTS = 6;
const CHECK_TRIES = 4;
/**
 * A made-up game of `plies` half-moves. The last move gives check when `lastGivesCheck` is true and avoids it when
 * false (undefined: no preference). No game here ends in checkmate.
 */
export function makeFollowGame(rng: Rng, plies: number, lastGivesCheck?: boolean): FollowGame {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const game = new Chess();
    const made: Move[] = [];
    const settle = (moves: Move[]): Move[] => {
      // The last move: with or without check, as asked (a move that mates is never wanted).
      if (lastGivesCheck === undefined) return moves;
      const wanted = moves.filter((m) => m.san.endsWith('+') === lastGivesCheck && !m.san.endsWith('#'));
      return wanted.length > 0 ? wanted : moves;
    };
    // Everything before the last two moves is simply played.
    while (made.length < plies - 2) {
      const moves = game.moves({ verbose: true });
      if (moves.length === 0) break;
      made.push(play(game, pickMove(rng, moves)));
    }
    if (made.length !== Math.max(0, plies - 2)) continue;
    let found = false;
    if (plies >= 2 && lastGivesCheck === true) {
      // A check is only possible when the position allows one: try a few second-to-last moves that do.
      for (let tries = 0; tries < CHECK_TRIES && !found; tries++) {
        const moves = game.moves({ verbose: true });
        if (moves.length === 0) break;
        made.push(play(game, pickMove(rng, moves)));
        const checks = game.moves({ verbose: true }).filter((m) => m.san.endsWith('+'));
        if (checks.length > 0) {
          made.push(play(game, pickMove(rng, checks)));
          found = true;
        } else {
          game.undo();
          made.pop();
        }
      }
      // No luck with this opening: start a new game (the last attempt takes what it gets).
      if (!found && attempt < ATTEMPTS - 1) continue;
    }
    while (made.length < plies) {
      const moves = game.moves({ verbose: true });
      if (moves.length === 0) break;
      made.push(play(game, pickMove(rng, made.length === plies - 1 ? settle(moves) : moves)));
    }
    if (made.length === plies && !game.isGameOver()) {
      return { sans: made.map((m) => m.san), game, ...followPieces(made) };
    }
  }
  // Only reached if 20 games in a row ended early: the plain opening is always fine.
  const game = new Chess();
  const made = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'].slice(0, plies).map((san) => game.move(san));
  return { sans: made.map((m) => m.san), game, ...followPieces(made) };
}

/**
 * "1.e4 e5 2.Nf3 Nc6 3.Bb5" and then one of: what is on a square, where a piece went, is it check. The moves stay
 * on the screen: the board does not, which is the whole drill.
 */
export function buildFollowQuestion(rng: Rng): DrillQuestion {
  const plies = 3 + randomInt(rng, 6);
  const roll = rng();

  if (roll < 0.2) {
    const wantCheck = rng() < 0.5;
    const { sans, game } = makeFollowGame(rng, plies, wantCheck);
    const check = game.inCheck();
    return {
      kind: 'follow',
      lead: movesText(sans),
      prompt: 'Is it check?',
      squares: [],
      options: YES_NO,
      answer: check ? 'yes' : 'no',
      explanation: check ? 'Yes, the last move gives check.' : 'No, the last move does not give check.',
    };
  }

  const { sans, game, where, touched } = makeFollowGame(rng, plies);

  if (roll < 0.55) {
    // What stands on a square? Mostly squares the moves touched (the start square of a mover is the best "empty").
    const square = touched.length > 0 && rng() < 0.85 ? pickFrom(rng, touched) : randomSquare(rng);
    const piece = game.get(square as never);
    return {
      kind: 'follow',
      lead: movesText(sans),
      prompt: `What is on ${square}?`,
      squares: [square],
      options: WHAT_OPTIONS,
      answer: piece ? PIECE_WORD[piece.type] : 'empty',
      explanation: piece
        ? `${square}: a ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_WORD[piece.type]}.`
        : `${square} is empty.`,
    };
  }

  // Where is the piece that started on a square? Only pieces that moved and are still on the board.
  const alive = Object.keys(where).filter((o) => where[o] !== null);
  const moved = alive.filter((o) => where[o] !== o);
  const origin = pickFrom(rng, moved.length > 0 ? moved : alive);
  const piece = new Chess().get(origin as never)!;
  const colour = piece.color === 'w' ? 'white' : 'black';
  return {
    kind: 'follow',
    lead: movesText(sans),
    prompt: `Where is the ${colour} ${PIECE_WORD[piece.type]} that started on ${origin}?`,
    squares: [origin],
    options: [],
    entry: 'square',
    answer: where[origin] as string,
    explanation: `The ${colour} ${PIECE_WORD[piece.type]} from ${origin} is on ${where[origin]}.`,
  };
}
