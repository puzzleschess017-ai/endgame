// Pure helpers for the Blindfold visualization drills (no React): question making, saved
// settings and best scores. The drills train what blindfold play needs: knowing the board by heart.

export type DrillKind = 'color' | 'diagonal' | 'knight';
export const DRILL_KINDS: DrillKind[] = ['color', 'diagonal', 'knight'];

/** Every drill is a run against the clock. */
export const DRILL_DURATION_MS = 60_000;

export const DRILLS_SETTINGS_STORAGE_KEY = 'ctg_drills_settings_v1';
export const DRILLS_BEST_STORAGE_KEY = 'ctg_drills_best_v1';

export const FILES = 'abcdefgh';

export function isDrillKind(value: unknown): value is DrillKind {
  return value === 'color' || value === 'diagonal' || value === 'knight';
}

export function drillLabel(kind: DrillKind): string {
  return kind === 'color' ? 'Square color' : kind === 'diagonal' ? 'Same diagonal' : 'Knight route';
}

export function drillDescription(kind: DrillKind): string {
  switch (kind) {
    case 'color':
      return 'Is the square light or dark? a1 is dark.';
    case 'diagonal':
      return 'Do two squares lie on the same diagonal? Think of a bishop.';
    case 'knight':
      return 'How many moves does a knight need to get from one square to the other?';
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
  kind: DrillKind;
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

/** A new random question. `previous` is avoided so the same question never comes twice in a row. */
export function makeQuestion(kind: DrillKind, rng: Rng = Math.random, previous?: DrillQuestion): DrillQuestion {
  for (let attempt = 0; attempt < 20; attempt++) {
    const q = buildQuestion(kind, rng);
    if (!previous || previous.prompt !== q.prompt) return q;
  }
  return buildQuestion(kind, rng);
}

function buildQuestion(kind: DrillKind, rng: Rng): DrillQuestion {
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
