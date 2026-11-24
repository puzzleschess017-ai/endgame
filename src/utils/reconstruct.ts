// Pure helpers for the "Rebuild position" drill (no React): comparing the rebuilt board with the real one,
// the settings and the best scores. The position to memorize is a real puzzle position from the server.


/** Piece limits offered for the drill (the longer positions are too much to rebuild from memory). */
export type ReconstructLevel = 6 | 7 | 8 | 10;
export const RECONSTRUCT_LEVELS: ReconstructLevel[] = [6, 7, 8, 10];

/** Seconds the position is shown. */
export type ReconstructSeconds = 10 | 20 | 30;
export const RECONSTRUCT_SECONDS: ReconstructSeconds[] = [10, 20, 30];

/** A round is this many positions. */
export const RECONSTRUCT_ROUND = 5;

export interface ReconstructSettings {
  level: ReconstructLevel;
  seconds: ReconstructSeconds;
}

export const DEFAULT_RECONSTRUCT_SETTINGS: ReconstructSettings = { level: 6, seconds: 20 };

export const RECONSTRUCT_SETTINGS_STORAGE_KEY = 'ctg_reconstruct_settings_v1';
/** Bests are kept in the same map as the other drills (and are synced with it), under "reconstruct:<level>". */
export const RECONSTRUCT_BEST_STORAGE_KEY = 'ctg_drills_best_v1';

export function isReconstructLevel(value: unknown): value is ReconstructLevel {
  return value === 6 || value === 7 || value === 8 || value === 10;
}

export function isReconstructSeconds(value: unknown): value is ReconstructSeconds {
  return value === 10 || value === 20 || value === 30;
}

const FILES = 'abcdefgh';

/** Square -> piece letter ("P" white pawn, "n" black knight, ...) for the first field of a FEN. Null if broken. */
export function placementMap(placement: string): Map<string, string> | null {
  const rows = placement.split(' ')[0].split('/');
  if (rows.length !== 8) return null;
  const map = new Map<string, string>();
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/[1-8]/.test(ch)) file += Number(ch);
      else if (/[pnbrqkPNBRQK]/.test(ch)) {
        if (file > 7) return null;
        map.set(`${FILES[file]}${8 - r}`, ch);
        file++;
      } else return null;
    }
    if (file !== 8) return null;
  }
  return map;
}

const NAME: Record<string, string> = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

/** "Nf3" for a white knight on f3 (black pieces get the same letter: the colour is told apart in the text). */
function describe(piece: string, square: string): string {
  const color = piece === piece.toUpperCase() ? 'white' : 'black';
  const kind = piece.toLowerCase() === 'p' ? 'pawn' : { n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[piece.toLowerCase()];
  return `${color} ${kind} on ${square}`;
}

export interface Comparison {
  /** Pieces standing on the right square. */
  correct: number;
  /** Pieces of the real position (what there was to place). */
  total: number;
  /** Real pieces that are missing or stand on a wrong square, as text ("white rook on d1"). */
  missed: string[];
  /** Pieces placed that are not in the real position, as text. */
  extra: string[];
  /** Exactly the real position. */
  perfect: boolean;
}

/** Compares the rebuilt placement with the real one. A piece counts only with the right colour and square. */
export function comparePlacement(real: string, rebuilt: string): Comparison {
  const truth = placementMap(real) ?? new Map<string, string>();
  const guess = placementMap(rebuilt) ?? new Map<string, string>();
  let correct = 0;
  const missed: string[] = [];
  const extra: string[] = [];
  for (const [square, piece] of truth) {
    if (guess.get(square) === piece) correct++;
    else missed.push(describe(piece, square));
  }
  for (const [square, piece] of guess) {
    if (truth.get(square) !== piece) extra.push(describe(piece, square));
  }
  return { correct, total: truth.size, missed, extra, perfect: missed.length === 0 && extra.length === 0 };
}

/** Short names for the summary line after a position, e.g. "Rd1" (squares and letters only). */
export function shortNames(list: string[]): string {
  return list
    .map((text) => {
      const m = /^(white|black) (\w+) on ([a-h][1-8])$/.exec(text);
      if (!m) return text;
      const letter = m[2] === 'pawn' ? '' : m[2] === 'knight' ? 'N' : m[2][0].toUpperCase();
      return `${m[1] === 'white' ? '' : '…'}${letter}${m[3]}`;
    })
    .join(', ');
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadReconstructSettings(): ReconstructSettings {
  const saved = readJson(RECONSTRUCT_SETTINGS_STORAGE_KEY) as Partial<ReconstructSettings> | null;
  return {
    level: isReconstructLevel(saved?.level) ? saved.level : DEFAULT_RECONSTRUCT_SETTINGS.level,
    seconds: isReconstructSeconds(saved?.seconds) ? saved.seconds : DEFAULT_RECONSTRUCT_SETTINGS.seconds,
  };
}

export function saveReconstructSettings(settings: ReconstructSettings): void {
  try {
    localStorage.setItem(RECONSTRUCT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function reconstructBestKey(level: ReconstructLevel): string {
  return `reconstruct:${level}`;
}

/** Best number of perfectly rebuilt positions in a round (out of RECONSTRUCT_ROUND), 0 if none. */
export function loadReconstructBest(level: ReconstructLevel): number {
  const parsed = readJson(RECONSTRUCT_BEST_STORAGE_KEY);
  const value = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)[reconstructBestKey(level)] : 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function saveReconstructBest(level: ReconstructLevel, perfect: number): { best: number; isNewBest: boolean } {
  const previous = loadReconstructBest(level);
  if (perfect <= 0 || perfect <= previous) return { best: previous, isNewBest: false };
  try {
    const parsed = readJson(RECONSTRUCT_BEST_STORAGE_KEY);
    const all = parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
    all[reconstructBestKey(level)] = Math.floor(perfect);
    localStorage.setItem(RECONSTRUCT_BEST_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
  return { best: Math.floor(perfect), isNewBest: true };
}
