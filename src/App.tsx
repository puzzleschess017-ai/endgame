import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, Square } from 'chess.js';
import type { Key } from 'chessground/types';
import ChessboardPanel, { type PendingPromotion } from './components/ChessboardPanel';
import SettingsPanel from './components/SettingsPanel';
import TrainerLayout from './components/TrainerLayout';
import TrainingSidebar from './components/TrainingSidebar';
import type {
  CycleResult,
  Puzzle,
  TrainingConfig,
  TrainingSession,
} from './types';
import {
  applyUciMove,
  getLegalDests,
  isPromotionMove,
  loadSessionFromStorage,
  saveSessionToStorage,
} from './utils/chessHelpers';
import { useAppearance } from './hooks/useAppearance';
import { authHeaders, useAuth } from './auth';
import { checkWoodpecker, defaultWoodpecker } from './utils/access';
import { playMoveSound } from './utils/sound';
import { recordFinishedCycles } from './utils/woodpeckerHistory';
import { readSavedUsername } from './utils/profile';

const PREVIEW_FEN = '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1';

interface BoardState {
  fen: string;
  playerColor: 'white' | 'black';
  turnColor: 'white' | 'black';
  dests: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check: 'white' | 'black' | false;
  locked: boolean;
}

export default function App() {
  const [username] = useState<string>(() => readSavedUsername());

  const { tier } = useAuth();
  const [config, setConfig] = useState<TrainingConfig>(() => defaultWoodpecker(tier));
  const [session, setSession] = useState<TrainingSession | null>(() => loadSessionFromStorage());
  const [appearance, setAppearance] = useAppearance();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncToken, setSyncToken] = useState(0);
  const [hintArrow, setHintArrow] = useState<[Key, Key] | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'idle' | 'continue' | 'error' | 'solved';
    message: string;
  }>({ type: 'idle', message: 'Find the best move' });

  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
  const [autoAdvancePaused, setAutoAdvancePaused] = useState(false);

  const [boardState, setBoardState] = useState<BoardState>({
    fen: PREVIEW_FEN,
    playerColor: 'white',
    turnColor: 'white',
    dests: new Map(),
    check: false,
    locked: true,
  });

  const chessRef = useRef<Chess>(new Chess(PREVIEW_FEN));
  const moveIndexRef = useRef<number>(1);
  const timersRef = useRef<number[]>([]);
  const lastTickRef = useRef<number>(Date.now());
  const sessionRef = useRef<TrainingSession | null>(session);
  sessionRef.current = session;

  const clearScheduledTimeouts = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  // Signing out (here or in another tab) closes the choices that need an account.
  useEffect(() => {
    if (!checkWoodpecker(tier, config).ok) setConfig(defaultWoodpecker(tier));
  }, [tier, config]);

  // Persist the session whenever it changes and on beforeunload (the appearance saves itself).
  useEffect(() => {
    saveSessionToStorage(session);
  }, [session]);

  // Home shows Woodpecker progress, so every finished cycle is also written to the long-term history.
  useEffect(() => {
    recordFinishedCycles(session);
  }, [session?.id, session?.cycleResults.length]);

  useEffect(() => {
    const handleUnload = () => {
      saveSessionToStorage(sessionRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Live training timer (only active once inside the training workspace)
  useEffect(() => {
    if (!session || session.status !== 'training') return;
    lastTickRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      if (delta <= 0 || delta > 5000) return;

      setSession((prev) => {
        if (!prev || prev.status !== 'training') return prev;
        return {
          ...prev,
          cycleElapsedMs: prev.cycleElapsedMs + delta,
          puzzleElapsedMs: prev.puzzleElapsedMs + delta,
        };
      });
    }, 500);

    return () => window.clearInterval(interval);
  }, [
    session?.status,
    session?.id,
    session?.currentCycle,
    session?.currentPuzzleIndex,
  ]);

  // Load current puzzle onto the chessboard when puzzle index, cycle, or auth view changes
  const currentPuzzle: Puzzle | null =
    session && session.puzzles[session.currentPuzzleIndex]
      ? session.puzzles[session.currentPuzzleIndex]
      : null;

  useEffect(() => {
    clearScheduledTimeouts();
    setPendingPromotion(null);
    setHintArrow(null);

    if (!session || session.status !== 'training' || !currentPuzzle) {
      if (!session) {
        chessRef.current = new Chess(PREVIEW_FEN);
        setBoardState({
          fen: PREVIEW_FEN,
          playerColor: 'white',
          turnColor: 'white',
          dests: new Map(),
          lastMove: undefined,
          check: false,
          locked: true,
        });
      }
      return;
    }

    const initialChess = new Chess(currentPuzzle.fen);
    chessRef.current = initialChess;
    moveIndexRef.current = 1;

    const setupTurn = initialChess.turn() === 'w' ? 'white' : 'black';
    const expectedPlayerColor = setupTurn === 'white' ? 'black' : 'white';

    setFeedback({
      type: 'idle',
      message: `Find the best move for ${expectedPlayerColor === 'white' ? 'White' : 'Black'}`,
    });

    setBoardState({
      fen: currentPuzzle.fen,
      playerColor: expectedPlayerColor,
      turnColor: setupTurn,
      dests: new Map(),
      lastMove: undefined,
      check: initialChess.inCheck() ? setupTurn : false,
      locked: true,
    });

    scheduleTimeout(() => {
      const setupUci = currentPuzzle.moves[0];
      const moveResult = applyUciMove(initialChess, setupUci);
      if (!moveResult) return;

      const nextTurn = initialChess.turn() === 'w' ? 'white' : 'black';
      setBoardState({
        fen: initialChess.fen(),
        playerColor: nextTurn,
        turnColor: nextTurn,
        dests: getLegalDests(initialChess),
        lastMove: [setupUci.slice(0, 2) as Key, setupUci.slice(2, 4) as Key],
        check: initialChess.inCheck() ? nextTurn : false,
        locked: false,
      });

      if (initialChess.inCheck()) {
        playMoveSound('check');
      } else if (moveResult.captured) {
        playMoveSound('capture');
      } else {
        playMoveSound('move');
      }
    }, 200);

    return () => {
      clearScheduledTimeouts();
    };
  }, [
    session?.id,
    session?.status,
    session?.currentCycle,
    session?.currentPuzzleIndex,
    currentPuzzle,
    clearScheduledTimeouts,
  ]);

  const startNextCycle = useCallback(() => {
    clearScheduledTimeouts();
    setAutoAdvanceSeconds(null);
    setAutoAdvancePaused(false);
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentCycle: prev.currentCycle + 1,
        currentPuzzleIndex: 0,
        cycleCorrect: 0,
        cycleIncorrect: 0,
        cycleElapsedMs: 0,
        puzzleElapsedMs: 0,
        currentPuzzleFailed: false,
        status: 'training',
      };
    });
  }, [clearScheduledTimeouts]);

  // Handle auto-advance countdown between cycles
  useEffect(() => {
    if (!session || session.status !== 'cycle_complete') {
      setAutoAdvanceSeconds(null);
      return;
    }
    if (autoAdvanceSeconds === null) {
      setAutoAdvanceSeconds(4);
      return;
    }
    if (autoAdvancePaused) return;
    if (autoAdvanceSeconds <= 0) {
      startNextCycle();
      return;
    }
    const id = window.setTimeout(() => {
      setAutoAdvanceSeconds((s) => (s !== null ? s - 1 : null));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [session?.status, autoAdvanceSeconds, autoAdvancePaused, startNextCycle]);

  const advanceToNextPuzzle = useCallback(
    (overrideCounts?: { correct: number; incorrect: number }) => {
      clearScheduledTimeouts();
      setSession((prev) => {
        if (!prev) return prev;
        const correct = overrideCounts ? overrideCounts.correct : prev.cycleCorrect;
        const incorrect = overrideCounts ? overrideCounts.incorrect : prev.cycleIncorrect;
        const nextIndex = prev.currentPuzzleIndex + 1;

        if (nextIndex < prev.puzzles.length) {
          return {
            ...prev,
            currentPuzzleIndex: nextIndex,
            puzzleElapsedMs: 0,
            currentPuzzleFailed: false,
          };
        }

        const total = prev.puzzles.length;
        const accuracy = total > 0 ? (correct / total) * 100 : 0;
        const cycleResult: CycleResult = {
          cycleNumber: prev.currentCycle,
          correct,
          incorrect,
          totalTimeMs: prev.cycleElapsedMs,
          accuracy,
          completedAt: Date.now(),
        };
        const updatedResults = [...prev.cycleResults, cycleResult];
        const isFinalCycle = prev.currentCycle >= prev.config.totalCycles;

        return {
          ...prev,
          cycleCorrect: correct,
          cycleIncorrect: incorrect,
          cycleResults: updatedResults,
          status: isFinalCycle ? 'all_complete' : 'cycle_complete',
        };
      });
    },
    [clearScheduledTimeouts]
  );

  const executeUserMove = useCallback(
    (orig: Key, dest: Key, promotion?: 'q' | 'r' | 'b' | 'n') => {
      if (!session || session.status !== 'training' || !currentPuzzle) return;

      const testChess = new Chess(chessRef.current.fen());
      let moveResult;
      try {
        moveResult = testChess.move({
          from: orig as Square,
          to: dest as Square,
          promotion,
        });
      } catch {
        setSyncToken((t) => t + 1);
        return;
      }

      if (!moveResult) {
        setSyncToken((t) => t + 1);
        return;
      }

      const mIdx = moveIndexRef.current;
      const expectedUci = currentPuzzle.moves[mIdx];
      const playedUci = `${orig}${dest}${promotion ?? ''}`;
      const isLastMove = mIdx === currentPuzzle.moves.length - 1;
      const isCorrect =
        playedUci === expectedUci || (isLastMove && testChess.isCheckmate());

      if (!isCorrect) {
        playMoveSound('error');
        setFeedback({
          type: 'error',
          message: 'Incorrect move — try again',
        });

        setSession((prev) => {
          if (!prev || prev.currentPuzzleFailed) return prev;
          return {
            ...prev,
            cycleIncorrect: prev.cycleIncorrect + 1,
            currentPuzzleFailed: true,
          };
        });

        setBoardState((prev) => ({ ...prev, locked: true }));
        scheduleTimeout(() => {
          const validChess = chessRef.current;
          const playerCol = validChess.turn() === 'w' ? 'white' : 'black';
          setBoardState((prev) => ({
            ...prev,
            fen: validChess.fen(),
            turnColor: playerCol,
            dests: getLegalDests(validChess),
            check: validChess.inCheck() ? playerCol : false,
            locked: false,
          }));
          setSyncToken((t) => t + 1);
        }, 250);
        return;
      }

      // Move is correct!
      chessRef.current = testChess;
      setHintArrow(null);

      if (mIdx + 1 >= currentPuzzle.moves.length) {
        playMoveSound('success');
        const oppColor = testChess.turn() === 'w' ? 'white' : 'black';
        setBoardState((prev) => ({
          ...prev,
          fen: testChess.fen(),
          turnColor: oppColor,
          dests: new Map(),
          lastMove: [orig, dest],
          check: testChess.inCheck() ? oppColor : false,
          locked: true,
        }));
        setFeedback({ type: 'solved', message: 'Puzzle solved' });

        const nextCorrect = session.currentPuzzleFailed
          ? session.cycleCorrect
          : session.cycleCorrect + 1;
        const nextIncorrect = session.cycleIncorrect;

        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            cycleCorrect: prev.currentPuzzleFailed ? prev.cycleCorrect : prev.cycleCorrect + 1,
          };
        });

        scheduleTimeout(() => {
          advanceToNextPuzzle({ correct: nextCorrect, incorrect: nextIncorrect });
        }, 550);
        return;
      }

      if (testChess.inCheck()) {
        playMoveSound('check');
      } else if (moveResult.captured) {
        playMoveSound('capture');
      } else {
        playMoveSound('move');
      }

      const oppTurn = testChess.turn() === 'w' ? 'white' : 'black';
      setBoardState((prev) => ({
        ...prev,
        fen: testChess.fen(),
        turnColor: oppTurn,
        dests: new Map(),
        lastMove: [orig, dest],
        check: testChess.inCheck() ? oppTurn : false,
        locked: true,
      }));
      setFeedback({ type: 'continue', message: 'Best move — continue the sequence' });

      scheduleTimeout(() => {
        const oppUci = currentPuzzle.moves[mIdx + 1];
        const oppResult = applyUciMove(testChess, oppUci);
        if (!oppResult) return;

        moveIndexRef.current = mIdx + 2;
        const playerTurn = testChess.turn() === 'w' ? 'white' : 'black';

        if (testChess.inCheck()) {
          playMoveSound('check');
        } else if (oppResult.captured) {
          playMoveSound('capture');
        } else {
          playMoveSound('move');
        }

        setBoardState((prev) => ({
          ...prev,
          fen: testChess.fen(),
          turnColor: playerTurn,
          dests: getLegalDests(testChess),
          lastMove: [oppUci.slice(0, 2) as Key, oppUci.slice(2, 4) as Key],
          check: testChess.inCheck() ? playerTurn : false,
          locked: false,
        }));
        setFeedback({
          type: 'idle',
          message: `Your turn (${playerTurn === 'white' ? 'White' : 'Black'})`,
        });
      }, 280);
    },
    [session, currentPuzzle, scheduleTimeout, advanceToNextPuzzle]
  );

  const handleUserMove = useCallback(
    (orig: Key, dest: Key) => {
      if (boardState.locked || !session || session.status !== 'training') return;
      if (isPromotionMove(chessRef.current, orig as Square, dest as Square)) {
        const promoColor = chessRef.current.turn() === 'w' ? 'white' : 'black';
        setPendingPromotion({
          from: orig,
          to: dest,
          color: promoColor,
        });
        return;
      }
      executeUserMove(orig, dest);
    },
    [boardState.locked, session, executeUserMove]
  );

  const handleSelectPromotion = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);
      executeUserMove(from, to, piece);
    },
    [pendingPromotion, executeUserMove]
  );

  const handleCancelPromotion = useCallback(() => {
    setPendingPromotion(null);
    setSyncToken((t) => t + 1);
  }, []);

  const handleRequestHint = useCallback(() => {
    if (!currentPuzzle || !session || session.status !== 'training') return;
    const expected = currentPuzzle.moves[moveIndexRef.current];
    if (!expected || expected.length < 4) return;
    setHintArrow([expected.slice(0, 2) as Key, expected.slice(2, 4) as Key]);

    // Using the hint means the puzzle was not solved unaided, so it counts as
    // incorrect (once per puzzle), exactly like a wrong move does.
    setSession((prev) => {
      if (!prev || prev.currentPuzzleFailed) return prev;
      return {
        ...prev,
        cycleIncorrect: prev.cycleIncorrect + 1,
        currentPuzzleFailed: true,
      };
    });
    setFeedback((prev) =>
      prev.type === 'error' || prev.type === 'solved'
        ? prev
        : { type: 'idle', message: 'Hint used — this puzzle counts as incorrect' },
    );
  }, [currentPuzzle, session]);

  const handleStartTraining = useCallback(async () => {
    const allowed = checkWoodpecker(tier, config);
    if (!allowed.ok) {
      setLoadError(allowed.reason);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        count: String(config.puzzleCount),
        difficulty: config.difficulty,
        mode: config.puzzleMode ?? 'endgame',
      });
      const res = await fetch(`/api/puzzles/sample?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load puzzles');
      }
      if (!Array.isArray(data.puzzles) || data.puzzles.length === 0) {
        throw new Error('No puzzles returned from database');
      }

      const newSession: TrainingSession = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        config: { ...config },
        puzzles: data.puzzles,
        currentCycle: 1,
        currentPuzzleIndex: 0,
        cycleCorrect: 0,
        cycleIncorrect: 0,
        cycleElapsedMs: 0,
        puzzleElapsedMs: 0,
        currentPuzzleFailed: false,
        status: 'training',
        cycleResults: [],
      };
      setAutoAdvancePaused(false);
      setAutoAdvanceSeconds(null);
      setSession(newSession);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to start training');
    } finally {
      setLoading(false);
    }
  }, [config, tier]);

  const handleResetSession = useCallback(() => {
    clearScheduledTimeouts();
    setPendingPromotion(null);
    setHintArrow(null);
    setAutoAdvanceSeconds(null);
    setAutoAdvancePaused(false);
    setSession(null);
    saveSessionToStorage(null);
  }, [clearScheduledTimeouts]);

  const handleRepeatSameSet = useCallback(() => {
    clearScheduledTimeouts();
    setAutoAdvanceSeconds(null);
    setAutoAdvancePaused(false);
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        currentCycle: 1,
        currentPuzzleIndex: 0,
        cycleCorrect: 0,
        cycleIncorrect: 0,
        cycleElapsedMs: 0,
        puzzleElapsedMs: 0,
        currentPuzzleFailed: false,
        status: 'training',
        cycleResults: [],
      };
    });
  }, [clearScheduledTimeouts]);

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={
        <>
          <ChessboardPanel
            fen={boardState.fen}
            orientation={boardState.playerColor}
            turnColor={boardState.turnColor}
            dests={boardState.dests}
            lastMove={boardState.lastMove}
            check={boardState.check}
            hintArrow={hintArrow}
            viewOnly={boardState.locked || !session || session.status !== 'training'}
            syncToken={syncToken}
            boardTheme={appearance.boardTheme}
            pieceSet={appearance.pieceSet}
            onUserMove={handleUserMove}
            pendingPromotion={pendingPromotion}
            onSelectPromotion={handleSelectPromotion}
            onCancelPromotion={handleCancelPromotion}
          />
        </>
      }
      panel={
        <>
          {!session || !currentPuzzle ? (
            <SettingsPanel
              config={config}
              onChange={setConfig}
              onStart={handleStartTraining}
              loading={loading}
              error={loadError}
              tier={tier}
            />
          ) : (
            <TrainingSidebar
              session={session}
              currentPuzzle={currentPuzzle}
              playerColor={boardState.playerColor}
              feedback={feedback}
              hintActive={Boolean(hintArrow)}
              onRequestHint={handleRequestHint}
              onNextPuzzle={() => advanceToNextPuzzle()}
              onResetSession={handleResetSession}
              onStartNextCycleNow={startNextCycle}
              autoAdvanceSeconds={autoAdvanceSeconds}
              autoAdvancePaused={autoAdvancePaused}
              onToggleAutoAdvancePause={() => setAutoAdvancePaused((p) => !p)}
              onRepeatSameSet={handleRepeatSameSet}
            />
          )}
        </>
      }
    />
  );
}
