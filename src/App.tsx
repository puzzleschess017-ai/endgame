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
import { nextCycle, resumeAfterReview, reviewSession, trimOldAttempts, type ReviewItem } from './utils/review';
import { readSavedUsername } from './utils/profile';
import { randomPreviewFen } from './utils/preview';


interface BoardState {
  fen: string;
  playerColor: 'white' | 'black';
  turnColor: 'white' | 'black';
  dests: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check: 'white' | 'black' | false;
  locked: boolean;
}

const SAVE_INTERVAL_MS = 5000;

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

  const [firstPreview] = useState(() => randomPreviewFen());
  const [boardState, setBoardState] = useState<BoardState>({
    fen: firstPreview,
    playerColor: 'white',
    turnColor: 'white',
    dests: new Map(),
    check: false,
    locked: true,
  });

  const chessRef = useRef<Chess>(new Chess(firstPreview));
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

  // The tab title: the server writes it for the first page load, and a click from another page does not load it again.
  useEffect(() => {
    document.title = 'Woodpecker Method: Chess Endgame Training | Chess Tactics Guide';
  }, []);

  // Persist the session when it changes. The timer changes it twice a second, and writing the whole session
  // (all puzzles) that often costs more than it is worth, so timer-only changes are saved at most every 5 s.
  // The last state is also written when the tab is hidden or closed.
  const lastSaveRef = useRef(0);
  const saveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    const flush = () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      lastSaveRef.current = Date.now();
      saveSessionToStorage(sessionRef.current);
    };
    const wait = SAVE_INTERVAL_MS - (Date.now() - lastSaveRef.current);
    if (wait <= 0) flush();
    else if (saveTimeoutRef.current === null) saveTimeoutRef.current = window.setTimeout(flush, wait);
  }, [session]);
  useEffect(() => {
    const flush = () => saveSessionToStorage(sessionRef.current);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, []);

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
        const preview = randomPreviewFen();
        chessRef.current = new Chess(preview);
        setBoardState({
          fen: preview,
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
    setSession((prev) => (prev ? nextCycle(prev) : prev));
  }, [clearScheduledTimeouts]);

  const advanceToNextPuzzle = useCallback(
    (overrideCounts?: { correct: number; incorrect: number }) => {
      clearScheduledTimeouts();
      setSession((prev) => {
        if (!prev) return prev;
        const correct = overrideCounts ? overrideCounts.correct : prev.cycleCorrect;
        const incorrect = overrideCounts ? overrideCounts.incorrect : prev.cycleIncorrect;
        const nextIndex = prev.currentPuzzleIndex + 1;
        const done = prev.puzzles[prev.currentPuzzleIndex];
        const attempts = done
          ? [
              ...(prev.cycleAttempts ?? []),
              { id: done.puzzleId, failed: prev.currentPuzzleFailed, ms: Math.max(0, Math.round(prev.puzzleElapsedMs)) },
            ]
          : (prev.cycleAttempts ?? []);

        if (nextIndex < prev.puzzles.length) {
          return {
            ...prev,
            cycleAttempts: attempts,
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
          attempts,
        };
        const updatedResults = trimOldAttempts([...prev.cycleResults, cycleResult]);
        const isFinalCycle = prev.currentCycle >= prev.config.totalCycles;

        return {
          ...prev,
          cycleCorrect: correct,
          cycleIncorrect: incorrect,
          cycleResults: updatedResults,
          cycleAttempts: [],
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

  const handleUserMoveLatest = (orig: Key, dest: Key) => {
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
  };
  const handleUserMoveRef = useRef(handleUserMoveLatest);
  handleUserMoveRef.current = handleUserMoveLatest;
  const handleUserMove = useCallback((orig: Key, dest: Key) => handleUserMoveRef.current(orig, dest), []);

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
        cycleAttempts: [],
      };
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
    setSession(null);
    saveSessionToStorage(null);
  }, [clearScheduledTimeouts]);

  const handleRepeatSameSet = useCallback(() => {
    clearScheduledTimeouts();
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
        cycleAttempts: [],
      };
    });
  }, [clearScheduledTimeouts]);

  /**
   * "Practise these": one cycle with only the missed and the slowest puzzles of the cycle that just ended. The
   * run it started from waits (as it is) and comes back afterwards; a review started from a review keeps
   * pointing at that same run.
   */
  const handleStartReview = useCallback(
    (items: ReviewItem[]) => {
      if (!session || items.length === 0) return;
      clearScheduledTimeouts();
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      setSession(reviewSession(session, items, id, session.resume ?? (session.review ? undefined : session)));
    },
    [session, clearScheduledTimeouts],
  );

  /** Back to the run a review came from: straight into its next cycle (startNext), or as it was left. */
  const handleResumeAfterReview = useCallback(
    (startNext: boolean) => {
      if (!session) return;
      const back = resumeAfterReview(session, startNext);
      if (!back) return;
      clearScheduledTimeouts();
      setPendingPromotion(null);
      setHintArrow(null);
      setSession(back);
    },
    [session, clearScheduledTimeouts],
  );

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
              onRepeatSameSet={handleRepeatSameSet}
              onStartReview={handleStartReview}
              onResumeAfterReview={handleResumeAfterReview}
            />
          )}
        </>
      }
    />
  );
}
