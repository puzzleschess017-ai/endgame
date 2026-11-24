import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CoordinateBoard, { type SquareMark } from '../components/CoordinateBoard';
import SiteHeader from '../components/SiteHeader';
import { BOARD_SIZE_CLASS_MAP, loadAppearanceSettings } from '../utils/appearance';
import {
  FILES,
  RANKS,
  accuracyPercent,
  loadBestScore,
  loadCoordinateSettings,
  randomSquare,
  saveBestScore,
  saveCoordinateSettings,
  type CoordinateDuration,
  type CoordinateMode,
  type CoordinateOrientation,
  type CoordinateSettings,
} from '../utils/coordinates';
import { readSavedUsername } from '../utils/profile';
import { playMoveSound } from '../utils/sound';

type Phase = 'setup' | 'running' | 'finished';

interface RunResult {
  correct: number;
  misses: number;
  accuracy: number;
  best: number;
  isNewBest: boolean;
}

interface Flash {
  /** Square the player clicked (find mode only). */
  clicked: string | null;
  /** Square that was the right answer. */
  expected: string;
  kind: 'correct' | 'wrong';
}

const FLASH_MS = 350;

const CARD_CLASS =
  'bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

const MODES: Array<{ value: CoordinateMode; label: string; hint: string }> = [
  { value: 'find', label: 'Find the square', hint: 'A square name is shown. Click that square on the board.' },
  { value: 'name', label: 'Name the square', hint: 'A square is highlighted. Type or tap its name.' },
];

const DURATIONS: CoordinateDuration[] = [30, 60];

const ORIENTATIONS: Array<{ value: CoordinateOrientation; label: string }> = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'random', label: 'Random' },
];

function segmentClass(active: boolean): string {
  return `py-2 px-2 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
    active ? 'bg-[#39ff88] text-[#101b2f] shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/10'
  }`;
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-[#39ff88]' : tone === 'bad' ? 'text-[#ff7a7a]' : 'text-white';
  return (
    <div className="bg-[#101b2f] border border-white/10 rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-white/65">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function CoordinatesPage() {
  const [settings, setSettings] = useState<CoordinateSettings>(() => loadCoordinateSettings());
  const [appearance] = useState(() => loadAppearanceSettings());
  const [username] = useState(() => readSavedUsername());
  const [muted, setMuted] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [target, setTarget] = useState('e4');
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [pendingRank, setPendingRank] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const phaseRef = useRef<Phase>('setup');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const targetRef = useRef('e4');
  const correctRef = useRef(0);
  const missesRef = useRef(0);
  const endAtRef = useRef(0);
  const flashTimerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<{ file: string | null; rank: string | null }>({ file: null, rank: null });

  useEffect(() => {
    document.title = 'Chess Coordinates Trainer | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Practice chess board coordinates against the clock: find the named square or name the highlighted square.',
      );
  }, []);

  useEffect(() => {
    saveCoordinateSettings(settings);
  }, [settings]);

  const resetPending = useCallback(() => {
    pendingRef.current = { file: null, rank: null };
    setPendingFile(null);
    setPendingRank(null);
  }, []);

  const finishRun = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    phaseRef.current = 'finished';
    window.clearTimeout(flashTimerRef.current);
    const c = correctRef.current;
    const m = missesRef.current;
    const { mode, duration } = settingsRef.current;
    const { best, isNewBest } = saveBestScore(mode, duration, c);
    setResult({ correct: c, misses: m, accuracy: accuracyPercent(c, m), best, isNewBest });
    setTimeLeftMs(0);
    setFlash(null);
    resetPending();
    setPhase('finished');
    playMoveSound('success', mutedRef.current);
  }, [resetPending]);

  const startRun = useCallback(() => {
    const s = settingsRef.current;
    const side: 'white' | 'black' =
      s.orientation === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : s.orientation;
    const first = randomSquare(null);
    window.clearTimeout(flashTimerRef.current);
    targetRef.current = first;
    correctRef.current = 0;
    missesRef.current = 0;
    endAtRef.current = performance.now() + s.duration * 1000;
    phaseRef.current = 'running';
    resetPending();
    setOrientation(side);
    setTarget(first);
    setCorrect(0);
    setMisses(0);
    setTimeLeftMs(s.duration * 1000);
    setFlash(null);
    setResult(null);
    setPhase('running');
  }, [resetPending]);

  const quitRun = useCallback(() => {
    phaseRef.current = 'setup';
    window.clearTimeout(flashTimerRef.current);
    resetPending();
    setFlash(null);
    setResult(null);
    setPhase('setup');
  }, [resetPending]);

  // Countdown. Uses the wall clock so a slow tab cannot stretch the run.
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) finishRun();
      else setTimeLeftMs(left);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, finishRun]);

  useEffect(() => () => window.clearTimeout(flashTimerRef.current), []);

  const handleAnswer = useCallback(
    (answer: string, byClick: boolean) => {
      if (phaseRef.current !== 'running') return;
      const expected = targetRef.current;
      const ok = answer === expected;
      if (ok) {
        correctRef.current += 1;
        setCorrect(correctRef.current);
        playMoveSound('move', mutedRef.current);
      } else {
        missesRef.current += 1;
        setMisses(missesRef.current);
        playMoveSound('error', mutedRef.current);
      }
      const next = randomSquare(expected);
      targetRef.current = next;
      setTarget(next);
      resetPending();
      window.clearTimeout(flashTimerRef.current);
      setFlash({ clicked: byClick ? answer : null, expected, kind: ok ? 'correct' : 'wrong' });
      flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS);
    },
    [resetPending],
  );

  const choosePart = useCallback(
    (kind: 'file' | 'rank', value: string) => {
      if (phaseRef.current !== 'running') return;
      const next = { ...pendingRef.current, [kind]: value };
      if (next.file && next.rank) {
        handleAnswer(`${next.file}${next.rank}`, false);
        return;
      }
      pendingRef.current = next;
      setPendingFile(next.file);
      setPendingRank(next.rank);
    },
    [handleAnswer],
  );

  // Keyboard entry for "Name the square": any order, e.g. "e" then "4" or "4" then "e".
  useEffect(() => {
    if (phase !== 'running' || settings.mode !== 'name') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key.length === 1 && key >= 'a' && key <= 'h') choosePart('file', key);
      else if (key.length === 1 && key >= '1' && key <= '8') choosePart('rank', key);
      else if (key === 'backspace' || key === 'escape') resetPending();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, settings.mode, choosePart, resetPending]);

  const marks = useMemo(() => {
    const m: Partial<Record<string, SquareMark>> = {};
    if (phase === 'running' && settings.mode === 'name') m[target] = 'target';
    if (flash) {
      if (flash.clicked) {
        if (flash.kind === 'correct') {
          m[flash.clicked] = 'correct';
        } else {
          m[flash.clicked] = 'wrong';
          m[flash.expected] = 'correct';
        }
      } else {
        m[flash.expected] = flash.kind;
      }
    }
    return m;
  }, [phase, settings.mode, target, flash]);

  const best = loadBestScore(settings.mode, settings.duration);
  const boardSizeClass = BOARD_SIZE_CLASS_MAP[appearance.boardSize] ?? 'max-w-[min(560px,100%)]';
  const totalMs = settings.duration * 1000;
  const secondsLeft = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const barPercent = Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100));
  const modeInfo = MODES.find((m) => m.value === settings.mode) ?? MODES[0];

  return (
    <div className="min-h-screen bg-[#101b2f] text-white flex flex-col">
      <SiteHeader username={username} muted={muted} onToggleMute={() => setMuted((v) => !v)} />

      <main className="flex-1 w-full max-w-[1220px] mx-auto px-4 sm:px-6 py-5 sm:py-7 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-8">
        <section className={`w-full ${boardSizeClass} flex flex-col gap-3 shrink-0`}>
          <CoordinateBoard
            orientation={phase === 'setup' ? (settings.orientation === 'black' ? 'black' : 'white') : orientation}
            theme={appearance.boardTheme}
            showLabels={settings.showLabels}
            marks={marks}
            onSquareClick={
              phase === 'running' && settings.mode === 'find' ? (sq) => handleAnswer(sq, true) : undefined
            }
          />
        </section>

        <aside className="w-full max-w-[560px] lg:w-[370px] shrink-0">
          {phase === 'setup' && (
            <div className={CARD_CLASS}>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Coordinates Trainer</h2>
                <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
                  Know every square without thinking. Score as many points as you can before the clock runs out.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Mode</span>
                <div className="grid grid-cols-1 gap-2.5">
                  {MODES.map((m) => {
                    const active = settings.mode === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSettings({ ...settings, mode: m.value })}
                        className={`py-2.5 px-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer min-h-[46px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                          active
                            ? 'bg-[#39ff88]/15 border-[#39ff88] text-white'
                            : 'bg-[#101b2f] border-white/10 text-white/90 hover:border-white/40 hover:text-white'
                        }`}
                      >
                        <div className="text-sm font-bold leading-tight">{m.label}</div>
                        <div className={`text-xs font-semibold mt-0.5 ${active ? 'text-[#39ff88]' : 'text-white/65'}`}>
                          {m.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Time</span>
                <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={settings.duration === d}
                      onClick={() => setSettings({ ...settings, duration: d })}
                      className={segmentClass(settings.duration === d)}
                    >
                      {d} s
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Playing as</span>
                <div className="grid grid-cols-3 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
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

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Board labels</span>
                <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
                  {[
                    { value: false, label: 'Hidden' },
                    { value: true, label: 'Shown' },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={settings.showLabels === o.value}
                      onClick={() => setSettings({ ...settings, showLabels: o.value })}
                      className={segmentClass(settings.showLabels === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm font-semibold text-white/75 tabular-nums">
                {best > 0 ? `Your best (${modeInfo.label}, ${settings.duration} s): ${best}` : 'No record yet for these settings.'}
              </p>

              <button
                type="button"
                onClick={startRun}
                className="w-full py-3.5 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]"
              >
                Start
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className={CARD_CLASS}>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-white">Time left</span>
                  <span className="text-2xl font-bold tabular-nums" data-testid="seconds-left">
                    {secondsLeft}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#101b2f] overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-[#39ff88]" style={{ width: `${barPercent}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Score" value={String(correct)} tone="good" />
                <StatTile label="Misses" value={String(misses)} tone="bad" />
                <StatTile label="Accuracy" value={`${accuracyPercent(correct, misses)}%`} />
              </div>

              {settings.mode === 'find' ? (
                <div className="text-center py-2">
                  <div className="text-xs font-semibold text-white/65">Click this square</div>
                  <div className="text-7xl font-bold tracking-tight text-[#39ff88] leading-none mt-2" data-testid="target">
                    {target}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-xs font-semibold text-white/65">Name the highlighted square</div>
                    <div className="flex justify-center gap-3 mt-3" data-testid="typed" aria-label="Typed square">
                      {[pendingFile, pendingRank].map((value, index) => (
                        <span
                          key={index}
                          className="w-14 h-16 rounded-xl border-2 border-white/20 bg-[#101b2f] flex items-center justify-center text-4xl font-bold text-[#39ff88]"
                        >
                          {value ?? ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="File">
                    {FILES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={pendingFile === f}
                        onClick={() => choosePart('file', f)}
                        className={`py-2.5 rounded-lg border text-sm font-bold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                          pendingFile === f
                            ? 'bg-[#39ff88] text-[#101b2f] border-[#39ff88]'
                            : 'bg-[#101b2f] border-white/15 text-white hover:border-white/50'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="Rank">
                    {RANKS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={pendingRank === r}
                        onClick={() => choosePart('rank', r)}
                        className={`py-2.5 rounded-lg border text-sm font-bold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                          pendingRank === r
                            ? 'bg-[#39ff88] text-[#101b2f] border-[#39ff88]'
                            : 'bg-[#101b2f] border-white/15 text-white hover:border-white/50'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-white/60 text-center">
                    You can also type it on the keyboard, e.g. “e” then “4”.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={quitRun}
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white text-white text-sm font-semibold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88]"
              >
                End run (not saved)
              </button>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className={CARD_CLASS} role="status" aria-live="polite">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-tight">Time’s up!</h2>
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
                <StatTile label="Best" value={String(result.best)} tone="good" />
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={startRun}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]"
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
        </aside>
      </main>
    </div>
  );
}
