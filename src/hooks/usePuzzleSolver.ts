// Plays one puzzle at a time on the board for Streak and Race (Woodpecker has its own, older logic).
//
// loadPuzzle() shows the puzzle: the opponent's first move is played, then the player moves.
// The hook checks every move, plays the opponent's replies, and calls onSolved when the whole line
// is found or onFailed on the first wrong move (no second try). The page decides what happens next.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import type { Key } from 'chessground/types';
import type { PendingPromotion } from '../components/ChessboardPanel';
import type { Puzzle } from '../types';
import { applyUciMove, getLegalDests, isPromotionMove } from '../utils/chessHelpers';
import { playMoveSound } from '../utils/sound';

/** Shown on the board before a run starts (same position as Woodpecker). */
export const PREVIEW_FEN = '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1';

const SETUP_MOVE_DELAY_MS = 200;
const REPLY_DELAY_MS = 280;

type Color = 'white' | 'black';

interface SolverBoard {
  fen: string;
  orientation: Color;
  turnColor: Color;
  dests: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check: Color | false;
  locked: boolean;
}

export interface FailedInfo {
  /** The move that was expected, e.g. "e2e4". */
  expectedUci: string;
  /** The same move in the usual notation, e.g. "Qh5+". */
  expectedSan: string;
}

interface Options {
  onSolved: (puzzle: Puzzle) => void;
  onFailed: (puzzle: Puzzle, info: FailedInfo) => void;
}

const PREVIEW_BOARD: SolverBoard = {
  fen: PREVIEW_FEN,
  orientation: 'white',
  turnColor: 'white',
  dests: new Map(),
  lastMove: undefined,
  check: false,
  locked: true,
};

const colorOf = (chess: Chess): Color => (chess.turn() === 'w' ? 'white' : 'black');
const asKey = (square: string) => square as Key;

export function usePuzzleSolver({ onSolved, onFailed }: Options) {
  const [board, setBoard] = useState<SolverBoard>(PREVIEW_BOARD);
  const [syncToken, setSyncToken] = useState(0);
  const [hintArrow, setHintArrow] = useState<[Key, Key] | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  const chessRef = useRef(new Chess(PREVIEW_FEN));
  const puzzleRef = useRef<Puzzle | null>(null);
  const moveIndexRef = useRef(1);
  const settledRef = useRef(true);
  const timersRef = useRef<number[]>([]);
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const playSoundFor = useCallback((chess: Chess, captured: boolean) => {
    playMoveSound(chess.inCheck() ? 'check' : captured ? 'capture' : 'move');
  }, []);

  const loadPuzzle = useCallback(
    (puzzle: Puzzle) => {
      clearTimers();
      setPendingPromotion(null);
      setHintArrow(null);
      puzzleRef.current = puzzle;
      settledRef.current = false;
      moveIndexRef.current = 1;

      const chess = new Chess(puzzle.fen);
      chessRef.current = chess;
      const setupTurn = colorOf(chess);
      const player: Color = setupTurn === 'white' ? 'black' : 'white';
      setBoard({
        fen: puzzle.fen,
        orientation: player,
        turnColor: setupTurn,
        dests: new Map(),
        lastMove: undefined,
        check: chess.inCheck() ? setupTurn : false,
        locked: true,
      });

      schedule(() => {
        const setupUci = puzzle.moves[0];
        const result = applyUciMove(chess, setupUci);
        if (!result) return;
        const turn = colorOf(chess);
        playSoundFor(chess, Boolean(result.captured));
        setBoard({
          fen: chess.fen(),
          orientation: player,
          turnColor: turn,
          dests: getLegalDests(chess),
          lastMove: [asKey(setupUci.slice(0, 2)), asKey(setupUci.slice(2, 4))],
          check: chess.inCheck() ? turn : false,
          locked: false,
        });
      }, SETUP_MOVE_DELAY_MS);
    },
    [clearTimers, schedule, playSoundFor],
  );

  /** Back to the preview position (no puzzle). */
  const reset = useCallback(() => {
    clearTimers();
    setPendingPromotion(null);
    setHintArrow(null);
    puzzleRef.current = null;
    settledRef.current = true;
    chessRef.current = new Chess(PREVIEW_FEN);
    setBoard(PREVIEW_BOARD);
    setSyncToken((t) => t + 1);
  }, [clearTimers]);

  /** Freezes the board where it is (time is up, run was ended). */
  const lock = useCallback(() => {
    clearTimers();
    setPendingPromotion(null);
    settledRef.current = true;
    setBoard((prev) => ({ ...prev, locked: true, dests: new Map() }));
    setSyncToken((t) => t + 1);
  }, [clearTimers]);

  const executeUserMove = useCallback(
    (orig: Key, dest: Key, promotion?: 'q' | 'r' | 'b' | 'n') => {
      const puzzle = puzzleRef.current;
      if (!puzzle || settledRef.current) return;

      const test = new Chess(chessRef.current.fen());
      let result;
      try {
        result = test.move({ from: orig as Square, to: dest as Square, promotion });
      } catch {
        setSyncToken((t) => t + 1);
        return;
      }
      if (!result) {
        setSyncToken((t) => t + 1);
        return;
      }

      const index = moveIndexRef.current;
      const expectedUci = puzzle.moves[index];
      const playedUci = `${orig}${dest}${promotion ?? ''}`;
      const isLastMove = index === puzzle.moves.length - 1;
      const correct = playedUci === expectedUci || (isLastMove && test.isCheckmate());

      if (!correct) {
        settledRef.current = true;
        clearTimers();
        const before = new Chess(chessRef.current.fen());
        const expectedMove = applyUciMove(before, expectedUci);
        playMoveSound('error');
        setHintArrow([asKey(expectedUci.slice(0, 2)), asKey(expectedUci.slice(2, 4))]);
        setBoard((prev) => ({
          ...prev,
          fen: chessRef.current.fen(),
          dests: new Map(),
          locked: true,
        }));
        setSyncToken((t) => t + 1);
        onFailedRef.current(puzzle, { expectedUci, expectedSan: expectedMove?.san ?? expectedUci });
        return;
      }

      chessRef.current = test;
      setHintArrow(null);
      const turn = colorOf(test);

      if (index + 1 >= puzzle.moves.length) {
        settledRef.current = true;
        playMoveSound('success');
        setBoard((prev) => ({
          ...prev,
          fen: test.fen(),
          turnColor: turn,
          dests: new Map(),
          lastMove: [orig, dest],
          check: test.inCheck() ? turn : false,
          locked: true,
        }));
        onSolvedRef.current(puzzle);
        return;
      }

      playSoundFor(test, Boolean(result.captured));
      setBoard((prev) => ({
        ...prev,
        fen: test.fen(),
        turnColor: turn,
        dests: new Map(),
        lastMove: [orig, dest],
        check: test.inCheck() ? turn : false,
        locked: true,
      }));

      schedule(() => {
        const replyUci = puzzle.moves[index + 1];
        const reply = applyUciMove(test, replyUci);
        if (!reply) return;
        moveIndexRef.current = index + 2;
        const playerTurn = colorOf(test);
        playSoundFor(test, Boolean(reply.captured));
        setBoard((prev) => ({
          ...prev,
          fen: test.fen(),
          turnColor: playerTurn,
          dests: getLegalDests(test),
          lastMove: [asKey(replyUci.slice(0, 2)), asKey(replyUci.slice(2, 4))],
          check: test.inCheck() ? playerTurn : false,
          locked: false,
        }));
      }, REPLY_DELAY_MS);
    },
    [clearTimers, schedule, playSoundFor],
  );

  const onUserMove = useCallback(
    (orig: Key, dest: Key) => {
      if (board.locked || settledRef.current) return;
      if (isPromotionMove(chessRef.current, orig as Square, dest as Square)) {
        setPendingPromotion({ from: orig, to: dest, color: colorOf(chessRef.current) });
        return;
      }
      executeUserMove(orig, dest);
    },
    [board.locked, executeUserMove],
  );

  const onSelectPromotion = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);
      executeUserMove(from, to, piece);
    },
    [pendingPromotion, executeUserMove],
  );

  const onCancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    setSyncToken((t) => t + 1);
  }, []);

  return {
    /** Which side the player moves for in the current puzzle. */
    playerColor: board.orientation,
    /** Props for <ChessboardPanel>; add boardTheme and pieceSet. */
    boardProps: {
      fen: board.fen,
      orientation: board.orientation,
      turnColor: board.turnColor,
      dests: board.dests,
      lastMove: board.lastMove,
      check: board.check,
      hintArrow,
      viewOnly: board.locked,
      syncToken,
      pendingPromotion,
      onUserMove,
      onSelectPromotion,
      onCancelPromotion,
    },
    loadPuzzle,
    reset,
    lock,
  };
}
