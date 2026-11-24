import { useCallback, useEffect, useRef, useState } from 'react';
import ChessboardPanel from '../components/ChessboardPanel';
import {
  CARD_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StatTile,
  segmentClass,
} from '../components/panelUi';
import TrainerLayout from '../components/TrainerLayout';
import { usePuzzleSolver, type FailedInfo } from '../hooks/usePuzzleSolver';
import type { Puzzle } from '../types';
import { useAppearance } from '../hooks/useAppearance';
import { LadderFeed } from '../utils/ladderFeed';
import { readSavedUsername } from '../utils/profile';
import { playMoveSound } from '../utils/sound';
import {
  RACE_DURATIONS,
  RACE_LADDER,
  WRONG_MOVE_PENALTY_MS,
  durationLabel,
  formatClock,
  loadRaceBest,
  loadRaceSettings,
  raceAccuracy,
  saveRaceBest,
  saveRaceSettings,
  type RaceSettings,
} from '../utils/race';

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
const PENALTY_FLASH_MS = 1000;
const TICK_MS = 100;

export default function RacePage() {
  const [settings, setSettings] = useState<RaceSettings>(() => loadRaceSettings());
  const [appearance, setAppearance] = useAppearance();
  const [username] = useState(() => readSavedUsername());
  const [muted, setMuted] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [solved, setSolved] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [note, setNote] = useState<{ kind: 'solved' | 'wrong'; text: string } | null>(null);
  const [penaltyVisible, setPenaltyVisible] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsRetry, setNeedsRetry] = useState(false);

  const phaseRef = useRef<Phase>('setup');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const runIdRef = useRef(0);
  const feedRef = useRef<LadderFeed | null>(null);
  const solvedRef = useRef(0);
  const wrongRef = useRef(0);
  const endAtRef = useRef(0);
  const nextTimerRef = useRef<number | undefined>(undefined);
  const penaltyTimerRef = useRef<number | undefined>(undefined);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    document.title = 'Puzzle Race | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Puzzle Race: solve as many chess puzzles as you can in 1, 3 or 5 minutes. A wrong move costs 10 seconds.',
      );
  }, []);

  useEffect(() => {
    saveRaceSettings(settings);
  }, [settings]);

  const clearTimers = useCallback(() => {
    window.clearTimeout(nextTimerRef.current);
    window.clearTimeout(penaltyTimerRef.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const solver = usePuzzleSolver({
    muted,
    onSolved: () => handleSolvedRef.current(),
    onFailed: (p, info) => handleFailedRef.current(p, info),
  });

  const finishRun = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    clearTimers();
    runIdRef.current += 1; // anything still loading belongs to a finished run
    solver.lock();
    const { duration } = settingsRef.current;
    const solvedCount = solvedRef.current;
    const wrongCount = wrongRef.current;
    const { best, isNewBest } = saveRaceBest(duration, solvedCount);
    setResult({
      solved: solvedCount,
      wrong: wrongCount,
      accuracy: raceAccuracy(solvedCount, wrongCount),
      best,
      isNewBest,
    });
    setTimeLeftMs(0);
    setPenaltyVisible(false);
    setPhaseBoth('finished');
    playMoveSound('success', mutedRef.current);
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
    endAtRef.current -= WRONG_MOVE_PENALTY_MS;
    const left = endAtRef.current - performance.now();
    setNote({ kind: 'wrong', text: `Wrong move. The best move was ${info.expectedSan}.` });
    setPenaltyVisible(true);
    window.clearTimeout(penaltyTimerRef.current);
    penaltyTimerRef.current = window.setTimeout(() => setPenaltyVisible(false), PENALTY_FLASH_MS);
    if (left <= 0) {
      finishRun();
      return;
    }
    setTimeLeftMs(left);
    scheduleNext(NEXT_AFTER_WRONG_MS);
  };

  // Countdown. Uses the wall clock so a slow tab cannot stretch the race.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) finishRun();
      else setTimeLeftMs(left);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, finishRun]);

  const startRun = useCallback(async () => {
    if (phaseRef.current === 'loading') return;
    clearTimers();
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const feed = new LadderFeed({ ...RACE_LADDER });
    feedRef.current = feed;
    solvedRef.current = 0;
    wrongRef.current = 0;
    setSolved(0);
    setWrong(0);
    setResult(null);
    setError(null);
    setNeedsRetry(false);
    setNote(null);
    setPenaltyVisible(false);
    setPuzzle(null);
    solver.reset();
    setPhaseBoth('loading');
    try {
      await feed.prepare(); // the clock only starts once the first puzzles are here
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load puzzles. Check your connection.');
      setPhaseBoth('setup');
      return;
    }
    if (runId !== runIdRef.current) return;
    const totalMs = settingsRef.current.duration * 1000;
    endAtRef.current = performance.now() + totalMs;
    setTimeLeftMs(totalMs);
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
    setPenaltyVisible(false);
    setPhaseBoth('setup');
  }, [clearTimers, solver]);

  const best = loadRaceBest(settings.duration);
  const totalMs = settings.duration * 1000;
  const barPercent = Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100));
  const lowTime = timeLeftMs > 0 && timeLeftMs <= 10_000;
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
      muted={muted}
      onToggleMute={() => setMuted((v) => !v)}
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
                <h2 className="text-xl font-bold text-white tracking-tight">Puzzle Race</h2>
                <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
                  Solve as many puzzles as you can before the clock runs out. They start easy and get
                  harder.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Time</span>
                <div className="grid grid-cols-3 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
                  {RACE_DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={settings.duration === d}
                      disabled={phase === 'loading'}
                      onClick={() => setSettings({ ...settings, duration: d })}
                      className={segmentClass(settings.duration === d)}
                    >
                      {durationLabel(d)}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm font-medium text-white/80 leading-relaxed">
                A wrong move costs <span className="font-bold text-[#ff7a7a]">10 seconds</span> and you
                move on to the next puzzle.
              </p>

              {error && (
                <div
                  role="alert"
                  className="text-sm font-medium text-[#ffd2cc] bg-[#401a22] border border-[#8f3848] rounded-xl px-3.5 py-2.5"
                >
                  {error}
                </div>
              )}

              <p className="text-sm font-semibold text-white/75 tabular-nums">
                {best > 0
                  ? `Your best (${durationLabel(settings.duration)}): ${best}`
                  : 'No record yet for this time.'}
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
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-white">Time left</span>
                  <span className="flex items-baseline gap-2">
                    {penaltyVisible && (
                      <span className="text-sm font-bold text-[#ff7a7a]" data-testid="penalty">
                        −{WRONG_MOVE_PENALTY_MS / 1000} s
                      </span>
                    )}
                    <span
                      className={`text-2xl font-bold tabular-nums ${lowTime ? 'text-[#ff7a7a]' : 'text-white'}`}
                      data-testid="clock"
                    >
                      {formatClock(timeLeftMs)}
                    </span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#101b2f] overflow-hidden" aria-hidden="true">
                  <div
                    className={`h-full ${lowTime ? 'bg-[#ff7a7a]' : 'bg-[#39ff88]'}`}
                    style={{ width: `${barPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Solved" value={String(solved)} tone="good" />
                <StatTile label="Wrong" value={String(wrong)} tone="bad" />
                <StatTile label="Puzzle rating" value={puzzle ? String(puzzle.rating) : '–'} />
              </div>

              <p
                className={`text-center text-sm font-semibold min-h-[20px] ${
                  note?.kind === 'wrong' ? 'text-[#ff7a7a]' : 'text-white/80'
                }`}
                aria-live="polite"
                data-testid="status"
              >
                {status}
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

              <button type="button" onClick={backToSetup} className={SECONDARY_BUTTON_CLASS}>
                End run (not saved)
              </button>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className={CARD_CLASS} role="status" aria-live="polite">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-tight">Time’s up!</h2>
                <div
                  className="text-7xl font-bold text-[#39ff88] leading-none mt-4 tabular-nums"
                  data-testid="final-solved"
                >
                  {result.solved}
                </div>
                <div className="text-sm font-semibold text-white/70 mt-2">
                  {result.solved === 1 ? 'puzzle solved' : 'puzzles solved'}
                </div>
                {result.isNewBest && (
                  <div className="inline-block mt-3 px-3 py-1 rounded-full bg-[#39ff88]/15 border border-[#39ff88] text-[#39ff88] text-xs font-bold">
                    New best!
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Accuracy" value={`${result.accuracy}%`} />
                <StatTile label="Wrong" value={String(result.wrong)} tone="bad" />
                <StatTile label={`Best (${durationLabel(settings.duration)})`} value={String(result.best)} tone="good" />
              </div>

              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={() => void startRun()} className={PRIMARY_BUTTON_CLASS}>
                  Play again
                </button>
                <button type="button" onClick={backToSetup} className={SECONDARY_BUTTON_CLASS}>
                  Change settings
                </button>
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
