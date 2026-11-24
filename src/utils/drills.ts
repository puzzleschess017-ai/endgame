// Pure helpers for the Blindfold visualization drills (no React): question making, saved
// settings and best scores. The drills train what blindfold play needs: knowing the board by heart.

export type DrillKind = 'color' | 'check' | 'diagonal' | 'knight' | 'reconstruct';
export const DRILL_KINDS: DrillKind[] = ['color', 'check', 'diagonal', 'knight', 'reconstruct'];

/** The drills made of quick questions against the clock ("reconstruct" is a different kind of exercise). */
export type QuestionKind = Exclude<DrillKind, 'reconstruct'>;
export const QUESTION_KINDS: QuestionKind[] = ['color', 'check', 'diagonal', 'knight'];

/** Every drill is a run against the clock. */
export const DRILL_DURATION_MS = 60_000;

export const DRILLS_SETTINGS_STORAGE_KEY = 'ctg_drills_settings_v1';
export const DRILLS_BEST_STORAGE_KEY = 'ctg_drills_best_v1';

export const FILES = 'abcdefgh';

export function isDrillKind(value: unknown): value is DrillKind {
  return value === 'color' || value === 'check' || value === 'diagonal' || value === 'knight' || value === 'reconstruct';
}

export function drillLabel(kind: DrillKind): string {
  switch (kind) {
    case 'color':
      return 'Square color';
    case 'check':
      return 'Check or not';
    case 'diagonal':
      return 'Same diagonal';
    case 'knight':
      return 'Knight route';
    case 'reconstruct':
      return 'Rebuild position';
  }
}

export function drillDescription(kind: DrillKind): string {
  switch (kind) {
    case 'color':
      return 'Is the square light or dark? a1 is dark.';
    case 'check':
      return 'A piece and a king are named, sometimes with a piece in the way. Is the king in check?';
    case 'diagonal':
      return 'Do two squares lie on the same diagonal? Think of a bishop.';
    case 'knight':
      return 'How many moves does a knight need to get from one square to the other?';
    case 'reconstruct':
      return 'Memorize a real position, then rebuild it from memory on an empty board.';
  }
}

function fileOf(square: string): number {
  return FILES.indexOf(square[0]);
}

function rankOf(square: string): number {
  return Number(square[1]) - 1;
}

function squareAt(file: number, rank: number): string {
  return `${FILES[file]}${rank + 1}`;
}

/** a1 is dark, h1 is light. */
export function isLightSquare(square: string): boolean {
  return (fileOf(square) + rankOf(square)) % 2 === 1;
}

/** True when a bishop on `a` could reach `b` on an empty board. */
export function onSameDiagonal(a: string, b: string): boolean {
  if (a === b) return false;
  return Math.abs(fileOf(a) - fileOf(b)) === Math.abs(rankOf(a) - rankOf(b));
}

const KNIGHT_JUMPS = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

/** Fewest knight moves between two squares on an empty board (0 for the same square). */
export function knightDistance(from: string, to: string): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let moves = 1; frontier.length > 0; moves++) {
    const next: string[] = [];
    for (const square of frontier) {
      for (const [df, dr] of KNIGHT_JUMPS) {
        const f = fileOf(square) + df;
        const r = rankOf(square) + dr;
        if (f < 0 || f > 7 || r < 0 || r > 7) continue;
        const target = squareAt(f, r);
        if (target === to) return moves;
        if (!seen.has(target)) {
          seen.add(target);
          next.push(target);
        }
      }
    }
    frontier = next;
  }
  return -1; // unreachable on an 8x8 board
}

export interface DrillOption {
  /** Text on the button. */
  label: string;
  /** What is compared with the question's answer. */
  value: string;
  /** Keyboard shortcut. */
  key: string;
}

export interface DrillQuestion {
  kind: QuestionKind;
  /** The question line shown to the player. */
  prompt: string;
  /** The squares the question is about (one or two). */
  squares: string[];
  options: DrillOption[];
  answer: string;
  /** Short explanation shown after a wrong answer. */
  explanation: string;
}

type Rng = () => number;

function randomInt(rng: Rng, max: number): number {
  return Math.min(max - 1, Math.floor(rng() * max));
}

function randomSquare(rng: Rng): string {
  return squareAt(randomInt(rng, 8), randomInt(rng, 8));
}

const COLOR_OPTIONS: DrillOption[] = [
  { label: 'Light', value: 'light', key: 'l' },
  { label: 'Dark', value: 'dark', key: 'd' },
];
const DIAGONAL_OPTIONS: DrillOption[] = [
  { label: 'Yes', value: 'yes', key: 'y' },
  { label: 'No', value: 'no', key: 'n' },
];
const KNIGHT_OPTIONS: DrillOption[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  label: String(n),
  value: String(n),
  key: String(n),
}));

/** All squares on the same diagonal as `square` (not the square itself). */
function diagonalSquares(square: string): string[] {
  const result: string[] = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const s = squareAt(f, r);
      if (onSameDiagonal(square, s)) result.push(s);
    }
  }
  return result;
}

export type CheckPiece = 'knight' | 'bishop' | 'rook' | 'queen' | 'pawn';
export type Side = 'white' | 'black';

/**
 * True when `piece` of colour `side` on `from` attacks `target` (a king there is in check). `blockers` are the
 * squares of other pieces: a bishop, rook or queen cannot see past them. Pawns attack one step forward
 * diagonally (white up the board, black down).
 */
export function givesCheck(piece: CheckPiece, side: Side, from: string, target: string, blockers: string[] = []): boolean {
  if (from === target) return false;
  const df = fileOf(target) - fileOf(from);
  const dr = rankOf(target) - rankOf(from);
  switch (piece) {
    case 'knight':
      return (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
    case 'pawn':
      return Math.abs(df) === 1 && dr === (side === 'white' ? 1 : -1);
    default: {
      const straight = df === 0 || dr === 0;
      const diagonal = Math.abs(df) === Math.abs(dr);
      if (piece === 'rook' && !straight) return false;
      if (piece === 'bishop' && !diagonal) return false;
      if (!straight && !diagonal) return false;
      const stepF = Math.sign(df);
      const stepR = Math.sign(dr);
      const between = Math.max(Math.abs(df), Math.abs(dr)) - 1;
      for (let i = 1; i <= between; i++) {
        if (blockers.includes(squareAt(fileOf(from) + stepF * i, rankOf(from) + stepR * i))) return false;
      }
      return true;
    }
  }
}

/** Squares strictly between two squares on one line (empty when they are not on a line or are neighbours). */
function squaresBetween(a: string, b: string): string[] {
  const df = fileOf(b) - fileOf(a);
  const dr = rankOf(b) - rankOf(a);
  if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return [];
  const n = Math.max(Math.abs(df), Math.abs(dr));
  const out: string[] = [];
  for (let i = 1; i < n; i++) out.push(squareAt(fileOf(a) + Math.sign(df) * i, rankOf(a) + Math.sign(dr) * i));
  return out;
}

/** Every square a piece would attack on an empty board (the blocker-free reach). */
function reach(piece: CheckPiece, side: Side, from: string): string[] {
  const out: string[] = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const square = squareAt(f, r);
      if (givesCheck(piece, side, from, square)) out.push(square);
    }
  }
  return out;
}

const CHECK_PIECES: CheckPiece[] = ['knight', 'bishop', 'rook', 'queen', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const BLOCKER_PIECES = ['pawn', 'knight', 'bishop', 'rook', 'queen'] as const;

function otherSide(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

function pickFrom<T>(rng: Rng, list: T[]): T {
  return list[randomInt(rng, list.length)];
}

/** A piece standing on `square`; a pawn never stands on the first or last rank. */
function makeBlocker(rng: Rng, square: string): { name: string; side: Side; square: string } {
  let name: string = pickFrom(rng, [...BLOCKER_PIECES]);
  if (name === 'pawn' && (rankOf(square) === 0 || rankOf(square) === 7)) name = 'knight';
  return { name, side: rng() < 0.5 ? 'white' : 'black', square };
}

function buildCheckQuestion(rng: Rng): DrillQuestion {
  const piece = pickFrom(rng, CHECK_PIECES);
  const side: Side = rng() < 0.5 ? 'white' : 'black';
  // A pawn on its first or last rank does not exist: keep to ranks 2-7 (and where it can still attack).
  let from: string;
  do from = randomSquare(rng);
  while (piece === 'pawn' && (rankOf(from) === 0 || rankOf(from) === 7));
  const slides = piece === 'bishop' || piece === 'rook' || piece === 'queen';
  const reachable = reach(piece, side, from);

  let king: string;
  let blockers: Array<{ name: string; side: Side; square: string }> = [];
  const wantCheck = rng() < 0.5;
  if (wantCheck) {
    king = pickFrom(rng, reachable);
    // Sometimes a piece stands to the side, off the line: it blocks nothing.
    if (slides && rng() < 0.3) {
      const line = squaresBetween(from, king);
      let square: string;
      let guard = 0;
      do square = randomSquare(rng);
      while ((square === from || square === king || line.includes(square)) && ++guard < 30);
      if (guard < 30) blockers = [makeBlocker(rng, square)];
    }
  } else {
    const line = (() => {
      // A king on the line, but with a piece in between, makes the best "no".
      const squares = reachable.filter((sq) => squaresBetween(from, sq).length > 0);
      return slides && squares.length > 0 && rng() < 0.45 ? pickFrom(rng, squares) : null;
    })();
    if (line) {
      king = line;
      const between = squaresBetween(from, king);
      blockers = [makeBlocker(rng, pickFrom(rng, between))];
    } else {
      const quiet: string[] = [];
      for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
        const square = squareAt(f, r);
        if (square !== from && !reachable.includes(square)) quiet.push(square);
      }
      king = pickFrom(rng, quiet);
    }
  }

  const check = givesCheck(piece, side, from, king, blockers.map((b) => b.square));
  const attacker = `${side === 'white' ? 'White' : 'Black'} ${piece} on ${from}`;
  const kingText = `${otherSide(side)} king on ${king}`;
  const blockText = blockers.map((b) => `${b.side} ${b.name} on ${b.square}`);
  const prompt = `${[attacker, kingText, ...blockText].join(', ')}. Is it check?`;
  const explanation = check
    ? `Yes, the ${piece} on ${from} attacks ${king}.`
    : blockers.length > 0 && givesCheck(piece, side, from, king)
      ? `No, the ${blockers[0].name} on ${blockers[0].square} is in the way.`
      : `No, the ${piece} on ${from} does not attack ${king}.`;
  return {
    kind: 'check',
    prompt,
    squares: [from, king, ...blockers.map((b) => b.square)],
    options: DIAGONAL_OPTIONS,
    answer: check ? 'yes' : 'no',
    explanation,
  };
}

/** A new random question. `previous` is avoided so the same question never comes twice in a row. */
export function makeQuestion(kind: QuestionKind, rng: Rng = Math.random, previous?: DrillQuestion): DrillQuestion {
  for (let attempt = 0; attempt < 20; attempt++) {
    const q = buildQuestion(kind, rng);
    if (!previous || previous.prompt !== q.prompt) return q;
  }
  return buildQuestion(kind, rng);
}

function buildQuestion(kind: QuestionKind, rng: Rng): DrillQuestion {
  if (kind === 'check') return buildCheckQuestion(rng);
  if (kind === 'color') {
    const square = randomSquare(rng);
    const light = isLightSquare(square);
    return {
      kind,
      prompt: `Is ${square} light or dark?`,
      squares: [square],
      options: COLOR_OPTIONS,
      answer: light ? 'light' : 'dark',
      explanation: `${square} is ${light ? 'light' : 'dark'}.`,
    };
  }

  if (kind === 'diagonal') {
    const a = randomSquare(rng);
    let b: string;
    if (rng() < 0.5) {
      const options = diagonalSquares(a);
      b = options[randomInt(rng, options.length)];
    } else {
      do {
        b = randomSquare(rng);
      } while (b === a || onSameDiagonal(a, b));
    }
    const same = onSameDiagonal(a, b);
    return {
      kind,
      prompt: `Are ${a} and ${b} on the same diagonal?`,
      squares: [a, b],
      options: DIAGONAL_OPTIONS,
      answer: same ? 'yes' : 'no',
      explanation: same
        ? `Yes, ${a} and ${b} share a diagonal.`
        : `No, ${a} and ${b} are not on one diagonal.`,
    };
  }

  const from = randomSquare(rng);
  let to: string;
  do {
    to = randomSquare(rng);
  } while (to === from);
  const moves = knightDistance(from, to);
  return {
    kind,
    prompt: `Knight from ${from} to ${to}: how many moves?`,
    squares: [from, to],
    options: KNIGHT_OPTIONS,
    answer: String(moves),
    explanation: `A knight needs ${moves} ${moves === 1 ? 'move' : 'moves'} from ${from} to ${to}.`,
  };
}

export function drillAccuracy(correct: number, wrong: number): number {
  const total = correct + wrong;
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadDrillKind(): DrillKind {
  const saved = readJson(DRILLS_SETTINGS_STORAGE_KEY) as { kind?: unknown } | null;
  return isDrillKind(saved?.kind) ? saved.kind : 'color';
}

export function saveDrillKind(kind: DrillKind): void {
  try {
    localStorage.setItem(DRILLS_SETTINGS_STORAGE_KEY, JSON.stringify({ kind }));
  } catch {
    // ignore storage errors
  }
}

export function loadDrillBest(kind: DrillKind): number {
  const parsed = readJson(DRILLS_BEST_STORAGE_KEY);
  const value = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[kind] : 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function saveDrillBest(kind: DrillKind, correct: number): { best: number; isNewBest: boolean } {
  const previous = loadDrillBest(kind);
  if (correct <= 0 || correct <= previous) return { best: previous, isNewBest: false };
  try {
    const parsed = readJson(DRILLS_BEST_STORAGE_KEY);
    const all = parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
    all[kind] = Math.floor(correct);
    localStorage.setItem(DRILLS_BEST_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return { best: Math.floor(correct), isNewBest: true };
}
