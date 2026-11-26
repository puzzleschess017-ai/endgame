import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CoordinateBoard, { type SquareMark } from '../components/CoordinateBoard';
import { CARD_CLASS, StatTile, segmentClass } from '../components/panelUi';
import TrainerLayout from '../components/TrainerLayout';
import { useAppearance } from '../hooks/useAppearance';
import { recordActivity } from '../utils/activity';
import {
  accuracyPercent,
  loadBestScore,
  loadCoordinateSettings,
  randomSquare,
  saveBestScore,
  saveCoordinateSettings,
  type CoordinateDuration,
  type CoordinateOrientation,
  type CoordinateSettings,
} from '../utils/coordinates';
import { readSavedUsername } from '../utils/profile';
import { playMoveSound } from '../utils/sound';

type Phase = 'setup' | 'running' | 'finished';

interface RunResult {
  /** The run had no clock: it ended when the player finished it, and it makes no record. */
  infinite: boolean;
  elapsedMs: number;
  correct: number;
  misses: number;
  accuracy: number;
  best: number;
  isNewBest: boolean;
}

interface Flash {
  /** Square the player clicked. */
  clicked: string;
  /** Square that was the right answer. */
  expected: string;
  kind: 'correct' | 'wrong';
}

const FLASH_MS = 350;

const DURATIONS: Array<{ value: CoordinateDuration; label: string }> = [
  { value: 30, label: '30 s' },
  { value: 'infinite', label: 'Infinite' },
];

/** 0:07, 1:05, ... (the clock of a run without a time limit). */
function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const ORIENTATIONS: Array<{ value: CoordinateOrientation; label: string }> = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
];

export default function CoordinatesPage() {
  const [settings, setSettings] = useState<CoordinateSettings>(() => loadCoordinateSettings());
  const [appearance, setAppearance] = useAppearance();
  const [username] = useState(() => readSavedUsername());

  const [phase, setPhase] = useState<Phase>('setup');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [target, setTarget] = useState('e4');
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const phaseRef = useRef<Phase>('setup');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const targetRef = useRef('e4');
  const correctRef = useRef(0);
  const missesRef = useRef(0);
  const endAtRef = useRef(0);
  const startAtRef = useRef(0);
  const flashTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    document.title = 'Chess Coordinates Trainer | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Practice chess board coordinates against the clock: click the named square as fast as you can.',
      );
  }, []);

  useEffect(() => {
    saveCoordinateSettings(settings);
  }, [settings]);

  const finishRun = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    phaseRef.current = 'finished';
    window.clearTimeout(flashTimerRef.current);
    const c = correctRef.current;
    const m = missesRef.current;
    const { duration } = settingsRef.current;
    const infinite = duration === 'infinite';
    const elapsedMs = infinite ? Math.round(performance.now() - startAtRef.current) : duration * 1000;
    // A run without a clock cannot be compared with others: it makes no record.
    const { best, isNewBest } = infinite ? { best: 0, isNewBest: false } : saveBestScore(duration, c);
    if (!infinite || c + m > 0) recordActivity({ mode: 'coordinates', ms: elapsedMs, correct: c, wrong: m });
    setResult({ infinite, elapsedMs, correct: c, misses: m, accuracy: accuracyPercent(c, m), best, isNewBest });
    setTimeLeftMs(0);
    setFlash(null);
    setPhase('finished');
    playMoveSound('success');
  }, []);

  const startRun = useCallback(() => {
    const s = settingsRef.current;
    const side = s.orientation;
    const first = randomSquare(null);
    window.clearTimeout(flashTimerRef.current);
    targetRef.current = first;
    correctRef.current = 0;
    missesRef.current = 0;
    startAtRef.current = performance.now();
    endAtRef.current = s.duration === 'infinite' ? 0 : startAtRef.current + s.duration * 1000;
    phaseRef.current = 'running';
    setOrientation(side);
    setTarget(first);
    setCorrect(0);
    setMisses(0);
    // Time left in a timed run, time passed in a run without a clock.
    setTimeLeftMs(s.duration === 'infinite' ? 0 : s.duration * 1000);
    setFlash(null);
    setResult(null);
    setPhase('running');
  }, []);

  const quitRun = useCallback(() => {
    phaseRef.current = 'setup';
    window.clearTimeout(flashTimerRef.current);
    setFlash(null);
    setResult(null);
    setPhase('setup');
  }, []);

  // Countdown. Uses the wall clock so a slow tab cannot stretch the run.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      if (settingsRef.current.duration === 'infinite') {
        setTimeLeftMs(performance.now() - startAtRef.current);
        return;
      }
      const left = endAtRef.current - performance.now();
      if (left <= 0) finishRun();
      else setTimeLeftMs(left);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, finishRun]);

  useEffect(() => () => window.clearTimeout(flashTimerRef.current), []);

  const handleAnswer = useCallback((answer: string) => {
    if (phaseRef.current !== 'running') return;
    const expected = targetRef.current;
    const ok = answer === expected;
    if (ok) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
      playMoveSound('move');
    } else {
      missesRef.current += 1;
      setMisses(missesRef.current);
      playMoveSound('error');
    }
    const next = randomSquare(expected);
    targetRef.current = next;
    setTarget(next);
    window.clearTimeout(flashTimerRef.current);
    setFlash({ clicked: answer, expected, kind: ok ? 'correct' : 'wrong' });
    flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  const marks = useMemo(() => {
    const m: Partial<Record<string, SquareMark>> = {};
    if (flash) {
      if (flash.kind === 'correct') {
        m[flash.clicked] = 'correct';
      } else {
        m[flash.clicked] = 'wrong';
        m[flash.expected] = 'correct';
      }
    }
    return m;
  }, [flash]);

  const infinite = settings.duration === 'infinite';
  const best = settings.duration === 'infinite' ? 0 : loadBestScore(settings.duration);
  const totalMs = settings.duration === 'infinite' ? 0 : settings.duration * 1000;
  const secondsLeft = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const barPercent = totalMs > 0 ? Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100)) : 0;

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={
        <CoordinateBoard
          orientation={phase === 'setup' ? settings.orientation : orientation}
          theme={appearance.boardTheme}
          marks={marks}
          onSquareClick={phase === 'running' ? handleAnswer : undefined}
        />
      }
      panel={
        <>
      {phase === 'setup' && (
        <div className={CARD_CLASS}>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Coordinates Trainer</h2>
            <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
              Know every square without thinking. Score as many points as you can before the clock runs out.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-white">Time</span>
            <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={settings.duration === d.value}
                  onClick={() => setSettings({ ...settings, duration: d.value })}
                  className={segmentClass(settings.duration === d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-white">Playing as</span>
            <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
              {ORIENTATIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={settings.orientation === o.value}
                  onClick={() => setSettings({ ...settings, orientation: o.value })}
                  className={segmentClass(settings.orientation === o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm font-semibold text-white/75 tabular-nums">
            {infinite
              ? 'No clock: practise as long as you like, then finish the run. Infinite runs make no record.'
              : best > 0
                ? `Your best (${settings.duration} s): ${best}`
                : 'No record yet for this time.'}
          </p>

          <button
            type="button"
            onClick={startRun}
            className="w-full py-3.5 px-5 rounded-xl btn-shine bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]"
          >
            Start
          </button>
        </div>
      )}

      {phase === 'running' && (
        <div className={CARD_CLASS}>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-white">{infinite ? 'Time' : 'Time left'}</span>
              <span className="text-2xl font-bold tabular-nums" data-testid="seconds-left">
                {infinite ? clockText(timeLeftMs) : secondsLeft}
              </span>
            </div>
            {!infinite && (
              <div className="h-2 rounded-full bg-[#101b2f] overflow-hidden" aria-hidden="true">
                <div className="h-full bg-[#39ff88]" style={{ width: `${barPercent}%` }} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <StatTile label="Score" value={String(correct)} tone="good" />
            <StatTile label="Misses" value={String(misses)} tone="bad" />
            <StatTile label="Accuracy" value={`${accuracyPercent(correct, misses)}%`} />
          </div>

          <div className="text-center py-2">
            <div className="text-xs font-semibold text-white/65">Click this square</div>
            <div className="text-7xl font-bold tracking-tight text-[#39ff88] leading-none mt-2" data-testid="target">
              {target}
            </div>
          </div>

          <button
            type="button"
            onClick={infinite ? finishRun : quitRun}
            className="w-full py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white text-white text-sm font-semibold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88]"
          >
            {infinite ? 'Finish run' : 'End run (not saved)'}
          </button>
        </div>
      )}

      {phase === 'finished' && result && (
        <div className={CARD_CLASS} role="status" aria-live="polite">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white tracking-tight">{result.infinite ? 'Run finished' : 'Time’s up!'}</h2>
            <div className="text-7xl font-bold text-[#39ff88] leading-none mt-4 tabular-nums" data-testid="final-score">
              {result.correct}
            </div>
            <div className="text-sm font-semibold text-white/70 mt-2">
              {result.correct === 1 ? 'point' : 'points'}
            </div>
            {result.isNewBest && (
              <div className="inline-block mt-3 px-3 py-1 rounded-full bg-[#39ff88]/15 border border-[#39ff88] text-[#39ff88] text-xs font-bold">
                New best!
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <StatTile label="Accuracy" value={`${result.accuracy}%`} />
            <StatTile label="Misses" value={String(result.misses)} tone="bad" />
            {result.infinite ? (
              <StatTile label="Time" value={clockText(result.elapsedMs)} />
            ) : (
              <StatTile label="Best" value={String(result.best)} tone="good" />
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={startRun}
              className="w-full py-3.5 px-5 rounded-xl btn-shine bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={quitRun}
              className="w-full py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white text-white text-sm font-semibold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88]"
            >
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
