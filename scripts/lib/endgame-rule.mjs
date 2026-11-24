// The material rule that decides whether a puzzle is a real endgame. It looks at the position
// AFTER the opponent's first move (that is the position the player sees).
// Shared by build-endgame-db.mjs and extend-db.mjs so the rule is defined in one place.

/** Lichess tags that mean "endgame". */
export const ENDGAME_TAGS = new Set([
  'endgame',
  'pawnEndgame',
  'rookEndgame',
  'bishopEndgame',
  'knightEndgame',
  'queenEndgame',
  'queenRookEndgame',
]);

/**
 * Board (array of 64 piece letters, '' for empty, a8 first) after `firstMove` is played on `fen`,
 * or null if the FEN or move can not be read.
 */
export function boardAfterFirstMove(fen, firstMove) {
  const spaceIdx = fen.indexOf(' ');
  if (spaceIdx === -1) return null;
  const boardStr = fen.slice(0, spaceIdx);
  const board = new Array(64).fill('');
  let sq = 0;
  for (let i = 0; i < boardStr.length; i++) {
    const ch = boardStr[i];
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') {
      sq += ch.charCodeAt(0) - 48;
    } else {
      if (sq >= 64) return null;
      board[sq++] = ch;
    }
  }
  if (sq !== 64 || firstMove.length < 4) return null;

  const f1 = firstMove.charCodeAt(0) - 97;
  const r1 = 8 - (firstMove.charCodeAt(1) - 48);
  const f2 = firstMove.charCodeAt(2) - 97;
  const r2 = 8 - (firstMove.charCodeAt(3) - 48);
  if (f1 < 0 || f1 > 7 || r1 < 0 || r1 > 7 || f2 < 0 || f2 > 7 || r2 < 0 || r2 > 7) {
    return null;
  }

  const fromIdx = r1 * 8 + f1;
  const toIdx = r2 * 8 + f2;
  let piece = board[fromIdx];
  if (!piece) return null;

  // en passant capture
  if ((piece === 'P' || piece === 'p') && f1 !== f2 && board[toIdx] === '') {
    board[r1 * 8 + f2] = '';
  }
  board[fromIdx] = '';
  if (firstMove.length === 5) {
    const promo = firstMove[4];
    piece = piece === 'P' ? promo.toUpperCase() : promo.toLowerCase();
  }
  board[toIdx] = piece;
  return board;
}

/** Number of pieces on the board, kings and pawns included. */
export function countPieces(board) {
  let n = 0;
  for (let i = 0; i < 64; i++) if (board[i]) n++;
  return n;
}

/** The material rule itself (same numbers as the original build script). */
export function hasEndgameMaterial(board) {
  let wQ = 0, wR = 0, wB = 0, wN = 0;
  let bQ = 0, bR = 0, bB = 0, bN = 0;
  for (let i = 0; i < 64; i++) {
    switch (board[i]) {
      case 'Q': wQ++; break;
      case 'R': wR++; break;
      case 'B': wB++; break;
      case 'N': wN++; break;
      case 'q': bQ++; break;
      case 'r': bR++; break;
      case 'b': bB++; break;
      case 'n': bN++; break;
    }
  }

  if (wQ > 1 || bQ > 1) return false;
  const wOther = wR + wB + wN;
  const bOther = bR + bB + bN;
  const wMat = 9 * wQ + 5 * wR + 3 * wB + 3 * wN;
  const bMat = 9 * bQ + 5 * bR + 3 * bB + 3 * bN;
  const totalMat = wMat + bMat;

  if (wQ === 0 && bQ === 0) {
    return wMat <= 13 && bMat <= 13 && totalMat <= 22;
  }
  if (wQ === 1 && bQ === 1) {
    return wOther <= 1 && bOther <= 1 && wMat <= 14 && bMat <= 14 && totalMat <= 28;
  }
  if (wQ === 1) {
    return wOther <= 1 && wMat <= 14 && bMat <= 13 && totalMat <= 24;
  }
  return bOther <= 1 && bMat <= 14 && wMat <= 13 && totalMat <= 24;
}

export function applyFirstMoveAndCheckEndgame(fen, firstMove) {
  const board = boardAfterFirstMove(fen, firstMove);
  return board !== null && hasEndgameMaterial(board);
}
