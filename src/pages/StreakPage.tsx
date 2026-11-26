import { useCallback, useEffect, useRef, useState } from 'react';
import ChessboardPanel from '../components/ChessboardPanel';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, StatTile } from '../components/panelUi';
import TrainerLayout from '../components/TrainerLayout';
import { usePuzzleSolver, type FailedInfo } from '../hooks/usePuzzleSolver';
import type { Puzzle } from '../types';
import { useAppearance } from '../hooks/useAppearance';
import { LadderFeed } from '../utils/ladderFeed';
import { readSavedUsername } from '../utils/profile';
import { playMoveSound } from '../utils/sound';
import { recordActivity } from '../utils/activity';
import {
  STREAK_LADDER,
  STREAK_SKIPS_ALLOWED,
  clearStreakRun,
  loadBestStreak,
  loadStreakRun,
  saveBestStreak,
  saveStreakRun,
} from '../utils/streak';

type Phase = 'setup' | 'loading' | 'running' | 'finished';
type EndReason = 'wrong' | 'ended' | 'cleared';

interface RunResult {
  streak: number;
  best: number;
  isNewBest: boolean;
  reason: EndReason;
  /** The move that was missed, in the usual notation (only after a wrong move). */
  expectedSan: string | null;
}

/** Pause after a solved puzzle before the next one appears. */
const NEXT_PUZZLE_DELAY_MS = 450;

export default function StreakPage() {
  const [appearance, setAppearance] = useAppearance();
  const [username] = useState(() => readSavedUsername());

  const [phase, setPhase] = useState<Phase>('setup');
  const [streak, setStreak] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(STREAK_SKIPS_ALLOWED);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsRetry, setNeedsRetry] = useState(false);

  const phaseRef = useRef<Phase>('setup');
  const runIdRef = useRef(0);
  const feedRef = useRef<LadderFeed | null>(null);
  const streakRef = useRef(0);
  const skipsRef = useRef(STREAK_SKIPS_ALLOWED);
  const advanceTimerRef = useRef<number | undefined>(undefined);
  const advancingRef = useRef(false);
  /** Puzzles taken from the ladder so far in this run (the next feed after a return starts there). */
  const rungRef = useRef(0);
  const puzzleRef = useRef<Puzzle | null>(null);

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  /** Remembers the run in progress, so leaving the page and coming back does not lose the streak. */
  const persistRun = () => {
    if (phaseRef.current !== 'running') return;
    saveStreakRun({
      streak: streakRef.current,
      skipsLeft: skipsRef.current,
      rung: rungRef.current,
      puzzle: puzzleRef.current,
      activeMs: Date.now() - runStartedAtRef.current,
    });
  };

  useEffect(() => {
    document.title = 'Puzzle Streak | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Puzzle Streak: solve chess puzzles that get harder one by one. One wrong move ends your streak.',
      );
  }, []);

  const finishRun = useCallback((reason: EndReason, info?: FailedInfo) => {
    if (phaseRef.current !== 'running') return;
    window.clearTimeout(advanceTimerRef.current);
    runIdRef.current += 1; // anything still loading belongs to a finished run
    advancingRef.current = false;
    clearStreakRun();
    const { best, isNewBest } = saveBestStreak(streakRef.current);
    recordActivity({
      mode: 'streak',
      ms: Date.now() - runStartedAtRef.current,
      correct: streakRef.current,
      wrong: reason === 'wrong' ? 1 : 0,
      puzzles: streakRef.current,
    });
    setResult({
      streak: streakRef.current,
      best,
      isNewBest,
      reason,
      expectedSan: info?.expectedSan ?? null,
    });
    setAdvancing(false);
    setNeedsRetry(false);
    setPhaseBoth('finished');
  }, []);

  const handleSolved = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    streakRef.current += 1;
    setStreak(streakRef.current);
    puzzleRef.current = null;
    persistRun();
    advancingRef.current = true;
    setAdvancing(true);
    const runId = runIdRef.current;
    advanceTimerRef.current = window.setTimeout(() => {
      if (runId === runIdRef.current) void showNextPuzzleRef.current();
    }, NEXT_PUZZLE_DELAY_MS);
  }, []);

  const handleFailed = useCallback(
    (_puzzle: Puzzle, info: FailedInfo) => {
      finishRun('wrong', info);
    },
    [finishRun],
  );

  const solver = usePuzzleSolver({ onSolved: handleSolved, onFailed: handleFailed });

  /** Loads the next puzzle of this run. Safe to call again after an error. */
  const showNextPuzzle = useCallback(async () => {
    const feed = feedRef.current;
    if (!feed || phaseRef.current !== 'running') return;
    const runId = runIdRef.current;
    setNeedsRetry(false);
    setError(null);
    try {
      const next = await feed.next();
      if (runId !== runIdRef.current || phaseRef.current !== 'running') return;
      if (!next) {
        finishRun('cleared');
        return;
      }
      setPuzzle(next);
      rungRef.current += 1;
      puzzleRef.current = next;
      persistRun();
      advancingRef.current = false;
      setAdvancing(false);
      solver.loadPuzzle(next);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load the next puzzle.');
      setNeedsRetry(true);
    }
  }, [finishRun, solver]);
  const runStartedAtRef = useRef(Date.now());
  const showNextPuzzleRef = useRef(showNextPuzzle);
  showNextPuzzleRef.current = showNextPuzzle;

  const startRun = useCallback(async () => {
    if (phaseRef.current === 'loading') return;
    window.clearTimeout(advanceTimerRef.current);
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const feed = new LadderFeed({ ...STREAK_LADDER });
    feedRef.current = feed;
    streakRef.current = 0;
    rungRef.current = 0;
    puzzleRef.current = null;
    clearStreakRun();
    skipsRef.current = STREAK_SKIPS_ALLOWED;
    setStreak(0);
    setSkipsLeft(STREAK_SKIPS_ALLOWED);
    setResult(null);
    setError(null);
    setNeedsRetry(false);
    advancingRef.current = false;
    setAdvancing(false);
    setPuzzle(null);
    solver.reset();
    setPhaseBoth('loading');
    try {
      await feed.prepare();
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load puzzles. Check your connection.');
      setPhaseBoth('setup');
      return;
    }
    if (runId !== runIdRef.current) return;
    runStartedAtRef.current = Date.now();
    setPhaseBoth('running');
    void showNextPuzzleRef.current();
  }, [solver]);

  const backToStart = useCallback(() => {
    clearStreakRun();
    window.clearTimeout(advanceTimerRef.current);
    runIdRef.current += 1;
    solver.reset();
    setPuzzle(null);
    setResult(null);
    setError(null);
    setPhaseBoth('setup');
  }, [solver]);

  const skipPuzzle = useCallback(() => {
    if (phaseRef.current !== 'running' || skipsRef.current <= 0 || advancingRef.current) return;
    skipsRef.current -= 1;
    setSkipsLeft(skipsRef.current);
    persistRun();
    playMoveSound('move');
    void showNextPuzzleRef.current();
  }, []);

  const endRun = useCallback(() => {
    solver.lock();
    finishRun('ended');
  }, [finishRun, solver]);

  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), []);

  // Coming back to a run that was still going: same streak, same skips, same puzzle.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    const saved = loadStreakRun();
    if (!saved) return;
    runIdRef.current += 1;
    feedRef.current = new LadderFeed({
      ...STREAK_LADDER,
      start: STREAK_LADDER.start + STREAK_LADDER.step * saved.rung,
    });
    streakRef.current = saved.streak;
    skipsRef.current = saved.skipsLeft;
    rungRef.current = saved.rung;
    puzzleRef.current = saved.puzzle;
    runStartedAtRef.current = Date.now() - saved.activeMs;
    setStreak(saved.streak);
    setSkipsLeft(saved.skipsLeft);
    setResult(null);
    setPhaseBoth('running');
    if (saved.puzzle) {
      setPuzzle(saved.puzzle);
      solver.loadPuzzle(saved.puzzle);
    } else {
      void showNextPuzzleRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const best = loadBestStreak();
  const sideName = solver.playerColor === 'white' ? 'White' : 'Black';

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={
        <ChessboardPanel
          {...solver.boardProps}
          boardTheme={appearance.boardTheme}
          pieceSet={appearance.pieceSet}
        />
      }
      panel={
        <>
          {(phase === 'setup' || phase === 'loading') && (
            <div className={CARD_CLASS}>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Puzzle Streak</h2>
                <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
                  Puzzles start easy and get harder with every one you solve. How long can your streak last?
                </p>
              </div>

              <ul className="space-y-2 text-sm font-medium text-white/85">
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-[#39ff88] font-bold">1</span>
                  One wrong move ends the streak.
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-[#39ff88] font-bold">2</span>
                  You can skip one puzzle per run.
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-[#39ff88] font-bold">3</span>
                  Puzzles come from the whole database, not only endgames.
                </li>
              </ul>

              {error && (
                <div
                  role="alert"
                  className="text-sm font-medium text-[#ffd2cc] bg-[#401a22] border border-[#8f3848] rounded-xl px-3.5 py-2.5"
                >
                  {error}
                </div>
              )}

              <p className="text-sm font-semibold text-white/75 tabular-nums">
                {best > 0 ? `Your best streak: ${best}` : 'No record yet.'}
              </p>

              <button
                type="button"
                onClick={() => void startRun()}
                disabled={phase === 'loading'}
                className={PRIMARY_BUTTON_CLASS}
              >
                {phase === 'loading' ? 'Loading puzzles…' : 'Start'}
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className={CARD_CLASS}>
              <div className="text-center">
                <div className="text-xs font-semibold text-white/65">Current streak</div>
                <div
                  className="text-7xl font-bold tracking-tight text-[#39ff88] leading-none mt-2 tabular-nums"
                  data-testid="streak"
                >
                  {streak}
                </div>
                <div className="text-xs font-semibold text-white/60 mt-2 tabular-nums">
                  {best > 0 ? `Best: ${best}` : 'No record yet'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Puzzle rating" value={puzzle ? String(puzzle.rating) : '–'} />
                <StatTile label="You play" value={puzzle ? sideName : '–'} />
                <StatTile label="Skips left" value={String(skipsLeft)} tone={skipsLeft > 0 ? 'good' : undefined} />
              </div>

              <p className="text-center text-sm font-semibold text-white/80" aria-live="polite" data-testid="status">
                {error
                  ? ''
                  : advancing
                    ? 'Correct!'
                    : puzzle
                      ? `Find the best move for ${sideName}`
                      : 'Loading the next puzzle…'}
              </p>

              {error && (
                <div
                  role="alert"
                  className="text-sm font-medium text-[#ffd2cc] bg-[#401a22] border border-[#8f3848] rounded-xl px-3.5 py-2.5 flex flex-col gap-2"
                >
                  <span>{error}</span>
                  {needsRetry && (
                    <button type="button" onClick={() => void showNextPuzzle()} className={SECONDARY_BUTTON_CLASS}>
                      Try again
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={skipPuzzle}
                  disabled={skipsLeft <= 0 || advancing || !puzzle}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {skipsLeft > 0 ? 'Skip this puzzle' : 'No skips left'}
                </button>
                <button type="button" onClick={endRun} className={SECONDARY_BUTTON_CLASS}>
                  End run
                </button>
              </div>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className={CARD_CLASS} role="status" aria-live="polite">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {result.reason === 'wrong'
                    ? 'Streak over'
                    : result.reason === 'cleared'
                      ? 'You solved them all!'
                      : 'Run ended'}
                </h2>
                <div
                  className="text-7xl font-bold text-[#39ff88] leading-none mt-4 tabular-nums"
                  data-testid="final-streak"
                >
                  {result.streak}
                </div>
                <div className="text-sm font-semibold text-white/70 mt-2">
                  {result.streak === 1 ? 'puzzle in a row' : 'puzzles in a row'}
                </div>
                {result.isNewBest && (
                  <div className="inline-block mt-3 px-3 py-1 rounded-full bg-[#39ff88]/15 border border-[#39ff88] text-[#39ff88] text-xs font-bold">
                    New best!
                  </div>
                )}
              </div>

              {result.expectedSan && (
                <p className="text-sm font-semibold text-white/80 text-center" data-testid="expected-move">
                  The best move was <span className="text-[#39ff88]">{result.expectedSan}</span> (shown on the board).
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="This run" value={String(result.streak)} />
                <StatTile label="Best" value={String(result.best)} tone="good" />
              </div>

              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={() => void startRun()} className={PRIMARY_BUTTON_CLASS}>
                  Play again
                </button>
                <button type="button" onClick={backToStart} className={SECONDARY_BUTTON_CLASS}>
                  Back
                </button>
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
