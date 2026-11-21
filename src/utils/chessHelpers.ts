import { Chess, Square } from 'chess.js';
import type { Key } from 'chessground/types';
import type { TrainingSession } from '../types';

export const STORAGE_KEY = 'endgame_woodpecker_session_v1';

export function getLegalDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  const moves = chess.moves({ verbose: true });
  for (const m of moves) {
    const from = m.from as Key;
    const to = m.to as Key;
    const existing = dests.get(from);
    if (existing) {
      if (!existing.includes(to)) {
        existing.push(to);
      }
    } else {
      dests.set(from, [to]);
    }
  }
  return dests;
}

export function isPromotionMove(chess: Chess, from: Square, to: Square): boolean {
  const moves = chess.moves({ square: from, verbose: true });
  return moves.some((m) => m.to === to && Boolean(m.promotion));
}

export function applyUciMove(chess: Chess, uci: string) {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.length >= 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
  return chess.move({ from, to, promotion });
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

const THEME_LABELS: Record<string, string> = {
  pawnEndgame: 'Pawn Endgame',
  rookEndgame: 'Rook Endgame',
  bishopEndgame: 'Bishop Endgame',
  knightEndgame: 'Knight Endgame',
  queenEndgame: 'Queen Endgame',
  queenRookEndgame: 'Queen & Rook Endgame',
  endgame: 'Endgame',
  zugzwang: 'Zugzwang',
  promotion: 'Promotion',
  underPromotion: 'Underpromotion',
  mate: 'Checkmate',
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  mateIn4: 'Mate in 4',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  deflection: 'Deflection',
  discoveredAttack: 'Discovered Attack',
  sacrifice: 'Sacrifice',
  interference: 'Interference',
  trappedPiece: 'Trapped Piece',
  backRankMate: 'Back Rank Mate',
  smotheredMate: 'Smothered Mate',
  advancedPawn: 'Advanced Pawn',
  passedPawn: 'Passed Pawn',
  opposition: 'Opposition',
};

export function getEndgameThemeLabel(themes: string[]): string {
  const specificOrder = [
    'pawnEndgame',
    'rookEndgame',
    'bishopEndgame',
    'knightEndgame',
    'queenEndgame',
    'queenRookEndgame',
  ];
  for (const key of specificOrder) {
    if (themes.includes(key)) {
      return THEME_LABELS[key];
    }
  }
  for (const t of themes) {
    if (t !== 'endgame' && THEME_LABELS[t]) {
      return THEME_LABELS[t];
    }
  }
  return 'Endgame';
}

export function saveSessionToStorage(session: TrainingSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadSessionFromStorage(): TrainingSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrainingSession;
    if (
      !parsed ||
      !Array.isArray(parsed.puzzles) ||
      parsed.puzzles.length === 0 ||
      !parsed.config
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
