import type { AppearanceSettings, BoardTheme, PieceSet } from '../types';

export const APPEARANCE_STORAGE_KEY = 'endgame_woodpecker_appearance_v1';
export const BOARD_THEME_STORAGE_KEY = 'endgame_woodpecker_board_theme';
export const PIECE_SET_STORAGE_KEY = 'endgame_woodpecker_piece_set';
export const BOARD_SIZE_STORAGE_KEY = 'endgame_woodpecker_board_size';

export const BOARD_SIZES = [320, 360, 400, 440, 480, 520, 560, 600, 640, 680, 720, 760] as const;
export const DEFAULT_BOARD_SIZE = 560;

/**
 * Look of every board on the site (Woodpecker and each training mode): rounded corners, a hairline
 * ring and a soft shadow, with no frame around it. Use this class on the element that is exactly
 * as big as the board so all modes look and measure the same.
 */
export const BOARD_FRAME_CLASS =
  'rounded-xl overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_16px_44px_rgba(4,9,20,0.45)]';

/**
 * Board edge length in px for a container of `raw` px: a whole number of 8 px squares, so the
 * squares are crisp and every mode ends up with exactly the same board. Null while unmeasured.
 */
export function snapBoardSize(raw: number): number | null {
  const whole = Math.floor(raw);
  if (!Number.isFinite(whole) || whole <= 0) return null;
  return Math.max(8, Math.floor(whole / 8) * 8);
}

export const BOARD_SIZE_CLASS_MAP: Record<number, string> = {
  320: 'max-w-[min(320px,100%)]',
  360: 'max-w-[min(360px,100%)]',
  400: 'max-w-[min(400px,100%)]',
  440: 'max-w-[min(440px,100%)]',
  480: 'max-w-[min(480px,100%)]',
  520: 'max-w-[min(520px,100%)]',
  560: 'max-w-[min(560px,100%)]',
  600: 'max-w-[min(600px,100%)]',
  640: 'max-w-[min(640px,100%)]',
  680: 'max-w-[min(680px,100%)]',
  720: 'max-w-[min(720px,100%)]',
  760: 'max-w-[min(760px,100%)]',
};

export const BOARD_THEMES: Array<{
  id: BoardTheme;
  name: string;
  lightClass: string;
  darkClass: string;
}> = [
  { id: 'green', name: 'Green', lightClass: 'bg-[#eeeed2]', darkClass: 'bg-[#769656]' },
  { id: 'brown', name: 'Brown', lightClass: 'bg-[#f0d9b5]', darkClass: 'bg-[#b58863]' },
  { id: 'blue', name: 'Blue', lightClass: 'bg-[#dee3e6]', darkClass: 'bg-[#8ca2ad]' },
  { id: 'purple', name: 'Purple', lightClass: 'bg-[#e6dff0]', darkClass: 'bg-[#7d5ba6]' },
  { id: 'grey', name: 'Grey', lightClass: 'bg-[#e0e0e0]', darkClass: 'bg-[#888888]' },
  { id: 'pink', name: 'Pink', lightClass: 'bg-[#f4e1e6]', darkClass: 'bg-[#c26a85]' },
];

export const PIECE_SETS: Array<{ id: PieceSet; name: string }> = [
  { id: 'merida', name: 'Merida' },
  { id: 'cburnett', name: 'Cburnett' },
  { id: 'alpha', name: 'Alpha' },
  { id: 'staunty', name: 'Staunty' },
  { id: 'chessnut', name: 'Chessnut' },
  { id: 'neo', name: 'Neo' },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  boardSize: DEFAULT_BOARD_SIZE,
  boardTheme: 'green',
  pieceSet: 'cburnett',
};

const VALID_THEMES = new Set<BoardTheme>(['green', 'brown', 'blue', 'purple', 'grey', 'pink']);
const VALID_PIECES = new Set<PieceSet>(['merida', 'cburnett', 'alpha', 'staunty', 'chessnut', 'neo']);

export function clampBoardSize(size: number): number {
  let closest: number = DEFAULT_BOARD_SIZE;
  let bestDiff = Infinity;
  for (const s of BOARD_SIZES) {
    const diff = Math.abs(s - size);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = s;
    }
  }
  return closest;
}

/** Width class for the board column of a given board size (falls back to the default size). */
export function boardSizeClassFor(size: number): string {
  return BOARD_SIZE_CLASS_MAP[size] ?? BOARD_SIZE_CLASS_MAP[DEFAULT_BOARD_SIZE];
}

/**
 * The next smaller (-1) or larger (+1) entry of BOARD_SIZES. Returns `size` itself at either end,
 * and moves a size that is not in the list to its nearest entry first.
 */
export function stepBoardSize(size: number, direction: -1 | 1): number {
  const current = clampBoardSize(size);
  const index = BOARD_SIZES.indexOf(current as (typeof BOARD_SIZES)[number]);
  const next = Math.min(BOARD_SIZES.length - 1, Math.max(0, index + direction));
  return BOARD_SIZES[next];
}

export function loadAppearanceSettings(): AppearanceSettings {
  let boardTheme: BoardTheme = DEFAULT_APPEARANCE.boardTheme;
  let pieceSet: PieceSet = DEFAULT_APPEARANCE.pieceSet;
  let boardSize: number = DEFAULT_APPEARANCE.boardSize;

  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
      if (typeof parsed.boardSize === 'number') {
        boardSize = clampBoardSize(parsed.boardSize);
      }
      if (parsed.boardTheme && VALID_THEMES.has(parsed.boardTheme as BoardTheme)) {
        boardTheme = parsed.boardTheme as BoardTheme;
      }
      if (parsed.pieceSet && VALID_PIECES.has(parsed.pieceSet as PieceSet)) {
        pieceSet = parsed.pieceSet as PieceSet;
      }
    }

    // Direct key fallbacks if saved as individual keys
    const directTheme = (
      localStorage.getItem(BOARD_THEME_STORAGE_KEY) ||
      localStorage.getItem('boardTheme') ||
      localStorage.getItem('board_theme')
    ) as BoardTheme | null;
    if (directTheme && VALID_THEMES.has(directTheme)) {
      boardTheme = directTheme;
    }

    const directPieces = (
      localStorage.getItem(PIECE_SET_STORAGE_KEY) ||
      localStorage.getItem('pieceSet') ||
      localStorage.getItem('piece_set')
    ) as PieceSet | null;
    if (directPieces && VALID_PIECES.has(directPieces)) {
      pieceSet = directPieces;
    }

    const directSize = localStorage.getItem(BOARD_SIZE_STORAGE_KEY) || localStorage.getItem('boardSize');
    if (directSize && !Number.isNaN(Number(directSize))) {
      boardSize = clampBoardSize(Number(directSize));
    }
  } catch {
    // Return defaults on error
  }

  return {
    boardSize,
    boardTheme,
    pieceSet,
  };
}

export function saveAppearanceSettings(settings: AppearanceSettings): void {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem(BOARD_THEME_STORAGE_KEY, settings.boardTheme);
    localStorage.setItem(PIECE_SET_STORAGE_KEY, settings.pieceSet);
    localStorage.setItem(BOARD_SIZE_STORAGE_KEY, String(settings.boardSize));
    // Additional shorthand keys for developer convenience
    localStorage.setItem('boardTheme', settings.boardTheme);
    localStorage.setItem('pieceSet', settings.pieceSet);
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function saveBoardTheme(theme: BoardTheme): void {
  try {
    const current = loadAppearanceSettings();
    saveAppearanceSettings({ ...current, boardTheme: theme });
  } catch {}
}

export function savePieceSet(pieceSet: PieceSet): void {
  try {
    const current = loadAppearanceSettings();
    saveAppearanceSettings({ ...current, pieceSet });
  } catch {}
}
