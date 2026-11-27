import { useCallback, useEffect, useRef, useState } from 'react';
import ChessboardPanel from '../components/ChessboardPanel';
import {
  CARD_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StatTile,
} from '../components/panelUi';
import TrainerLayout from '../components/TrainerLayout';
import { usePuzzleSolver, type FailedInfo } from '../hooks/usePuzzleSolver';
import type { Puzzle } from '../types';
import { useAppearance } from '../hooks/useAppearance';
import { LadderFeed } from '../utils/ladderFeed';
import { readSavedUsername } from '../utils/profile';
import { playMoveSound } from '../utils/sound';
import { recordActivity } from '../utils/activity';
import {
  SURVIVAL_LADDER,
  SURVIVAL_STRIKES,
  loadSurvivalBest,
  saveSurvivalBest,
  strikesLeft,
  survivalAccuracy,
} from '../utils/survival';

type Phase = 'setup' | 'loading' | 'running' | 'finished';

interface RunResult {
  solved: number;
  wrong: number;
  accuracy: number;
  best: number;
  isNewBest: boolean;
}

/** Pause after a solved puzzle, and after a wrong one (long enough to see the right move). */
const NEXT_AFTER_SOLVED_MS = 250;
const NEXT_AFTER_WRONG_MS = 1000;

export default function SurvivalPage() {
  const [appearance, setAppearance] = useAppearance();
  const [username] = useState(() => readSavedUsername());

  const [phase, setPhase] = useState<Phase>('setup');
  const [solved, setSolved] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [note, setNote] = useState<{ kind: 'solved' | 'wrong'; text: string } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsRetry, setNeedsRetry] = useState(false);

  const phaseRef = useRef<Phase>('setup');
  const runIdRef = useRef(0);
  const feedRef = useRef<LadderFeed | null>(null);
  const solvedRef = useRef(0);
  const wrongRef = useRef(0);
  const runStartedAtRef = useRef(Date.now());
  const nextTimerRef = useRef<number | undefined>(undefined);

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    document.title = 'Puzzle Survival | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Puzzle Survival: solve chess puzzles that get harder one by one. You can make 2 mistakes; the third one ends the run.',
      );
  }, []);

  const clearTimers = useCallback(() => {
    window.clearTimeout(nextTimerRef.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const solver = usePuzzleSolver({
    onSolved: () => handleSolvedRef.current(),
    onFailed: (p, info) => handleFailedRef.current(p, info),
  });

  const finishRun = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    clearTimers();
    runIdRef.current += 1; // anything still loading belongs to a finished run
    solver.lock();
    const solvedCount = solvedRef.current;
    const wrongCount = wrongRef.current;
    const { best, isNewBest } = saveSurvivalBest(solvedCount);
    recordActivity({
      mode: 'survival',
      ms: Math.max(0, Date.now() - runStartedAtRef.current),
      correct: solvedCount,
      wrong: wrongCount,
      puzzles: solvedCount,
    });
    setResult({
      solved: solvedCount,
      wrong: wrongCount,
      accuracy: survivalAccuracy(solvedCount, wrongCount),
      best,
      isNewBest,
    });
    setPhaseBoth('finished');
    playMoveSound('success');
  }, [clearTimers, solver]);

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
        finishRun(); // the ladder ran out of puzzles
        return;
      }
      setPuzzle(next);
      setNote(null);
      solver.loadPuzzle(next);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load the next puzzle.');
      setNeedsRetry(true);
    }
  }, [finishRun, solver]);
  const showNextPuzzleRef = useRef(showNextPuzzle);
  showNextPuzzleRef.current = showNextPuzzle;

  const scheduleNext = useCallback((delayMs: number) => {
    const runId = runIdRef.current;
    window.clearTimeout(nextTimerRef.current);
    nextTimerRef.current = window.setTimeout(() => {
      if (runId === runIdRef.current) void showNextPuzzleRef.current();
    }, delayMs);
  }, []);

  const handleSolvedRef = useRef<() => void>(() => undefined);
  handleSolvedRef.current = () => {
    if (phaseRef.current !== 'running') return;
    solvedRef.current += 1;
    setSolved(solvedRef.current);
    setNote({ kind: 'solved', text: 'Correct!' });
    scheduleNext(NEXT_AFTER_SOLVED_MS);
  };

  const handleFailedRef = useRef<(p: Puzzle, info: FailedInfo) => void>(() => undefined);
  handleFailedRef.current = (_p, info) => {
    if (phaseRef.current !== 'running') return;
    wrongRef.current += 1;
    setWrong(wrongRef.current);
    if (strikesLeft(wrongRef.current) <= 0) {
      finishRun();
      return;
    }
    setNote({ kind: 'wrong', text: `Wrong move. The best move was ${info.expectedSan}.` });
    scheduleNext(NEXT_AFTER_WRONG_MS);
  };

  const startRun = useCallback(async () => {
    if (phaseRef.current === 'loading') return;
    clearTimers();
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const feed = new LadderFeed({ ...SURVIVAL_LADDER });
    feedRef.current = feed;
    solvedRef.current = 0;
    wrongRef.current = 0;
    setSolved(0);
    setWrong(0);
    setResult(null);
    setError(null);
    setNeedsRetry(false);
    setNote(null);
    setPuzzle(null);
    solver.reset();
    setPhaseBoth('loading');
    try {
      await feed.prepare(); // the run only starts once the first puzzles are here
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
  }, [clearTimers, solver]);

  const backToSetup = useCallback(() => {
    clearTimers();
    runIdRef.current += 1;
    solver.reset();
    setPuzzle(null);
    setResult(null);
    setError(null);
    setNote(null);
    setPhaseBoth('setup');
  }, [clearTimers, solver]);

  const best = loadSurvivalBest();
  const left = strikesLeft(wrong);
  const sideName = solver.playerColor === 'white' ? 'White' : 'Black';
  const status = error
    ? ''
    : note
      ? note.text
      : puzzle
        ? `Find the best move for ${sideName}`
        : 'Loading the next puzzle…';

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
                <h2 className="text-xl font-bold text-white tracking-tight">Puzzle Survival</h2>
                <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
                  Solve puzzles for as long as you can. They start easy and get harder one by one. There is no clock, so
                  take your time.
                </p>
              </div>

              <p className="text-sm font-medium text-white/80 leading-relaxed">
                You have <span className="font-bold text-danger">{SURVIVAL_STRIKES} lives</span>. Every wrong move costs
                one, and the run ends when the last one is gone. Your score is the number of puzzles you solved.
              </p>

              {error && (
                <div
                  role="alert"
                  className="text-sm font-medium text-danger-ink bg-danger-bg border border-danger-line rounded-xl px-3.5 py-2.5"
                >
                  {error}
                </div>
              )}

              <p className="text-sm font-semibold text-white/75 tabular-nums">
                {best > 0 ? `Your best: ${best}` : 'No record yet.'}
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
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Lives</span>
                <span
                  className="flex items-center gap-1.5 text-2xl leading-none"
                  data-testid="lives"
                  role="img"
                  aria-label={`${left} of ${SURVIVAL_STRIKES} lives left`}
                >
                  {Array.from({ length: SURVIVAL_STRIKES }, (_, i) => (
                    <span key={i} aria-hidden="true" className={i < left ? 'text-danger' : 'text-white/20'}>
                      {i < left ? '♥' : '♡'}
                    </span>
                  ))}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Solved" value={String(solved)} tone="good" />
                <StatTile label="Wrong" value={String(wrong)} tone="bad" />
                <StatTile label="Puzzle rating" value={puzzle ? String(puzzle.rating) : '–'} />
              </div>

              <p
                className={`text-center text-sm font-semibold min-h-[20px] ${
                  note?.kind === 'wrong' ? 'text-danger' : 'text-white/80'
                }`}
                aria-live="polite"
                data-testid="status"
              >
                {status}
              </p>

              {error && (
                <div
                  role="alert"
                  className="text-sm font-medium text-danger-ink bg-danger-bg border border-danger-line rounded-xl px-3.5 py-2.5 flex flex-col gap-2"
                >
                  <span>{error}</span>
                  {needsRetry && (
                    <button type="button" onClick={() => void showNextPuzzle()} className={SECONDARY_BUTTON_CLASS}>
                      Try again
                    </button>
                  )}
                </div>
              )}

              <button type="button" onClick={backToSetup} className={SECONDARY_BUTTON_CLASS}>
                End run (not saved)
              </button>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className={CARD_CLASS} role="status" aria-live="polite">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-tight">Run over</h2>
                <div
                  className="text-7xl font-bold text-accent leading-none mt-4 tabular-nums"
                  data-testid="final-solved"
                >
                  {result.solved}
                </div>
                <div className="text-sm font-semibold text-white/70 mt-2">
                  {result.solved === 1 ? 'puzzle solved' : 'puzzles solved'}
                </div>
                {result.isNewBest && (
                  <div className="inline-block mt-3 px-3 py-1 rounded-full bg-accent/15 border border-accent text-accent text-xs font-bold">
                    New best!
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Accuracy" value={`${result.accuracy}%`} />
                <StatTile label="Wrong" value={String(result.wrong)} tone="bad" />
                <StatTile label="Best" value={String(result.best)} tone="good" />
              </div>

              <button type="button" onClick={() => void startRun()} className={PRIMARY_BUTTON_CLASS}>
                Play again
              </button>
            </div>
          )}
        </>
      }
    />
  );
}
