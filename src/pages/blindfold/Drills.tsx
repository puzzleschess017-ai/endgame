import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARD_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StatTile,
  segmentClass,
} from '../../components/panelUi';
import TrainerLayout from '../../components/TrainerLayout';
import { BOARD_SIZE_CLASS_MAP, loadAppearanceSettings } from '../../utils/appearance';
import {
  DRILL_DURATION_MS,
  DRILL_KINDS,
  drillAccuracy,
  drillDescription,
  drillLabel,
  loadDrillBest,
  loadDrillKind,
  makeQuestion,
  saveDrillBest,
  saveDrillKind,
  type DrillKind,
  type DrillQuestion,
} from '../../utils/drills';
import { formatClock } from '../../utils/race';
import { playMoveSound } from '../../utils/sound';
import { ModeTabs, type BlindfoldModeProps } from './shared';

type Phase = 'setup' | 'running' | 'finished';

interface DrillResult {
  correct: number;
  wrong: number;
  accuracy: number;
  best: number;
  isNewBest: boolean;
}

const TICK_MS = 100;

export default function Drills({ username, muted, onToggleMute, mode, onModeChange }: BlindfoldModeProps) {
  const [kind, setKind] = useState<DrillKind>(() => loadDrillKind());
  const [appearance] = useState(() => loadAppearanceSettings());
  const [phase, setPhase] = useState<Phase>('setup');
  const [question, setQuestion] = useState<DrillQuestion | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [msLeft, setMsLeft] = useState(DRILL_DURATION_MS);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<DrillResult | null>(null);

  const phaseRef = useRef<Phase>('setup');
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const questionRef = useRef<DrillQuestion | null>(null);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const endAtRef = useRef(0);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    document.title = 'Blindfold Chess Drills | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Chess visualization drills: square colors, diagonals and knight routes, with no board to look at.',
      );
  }, []);

  useEffect(() => {
    saveDrillKind(kind);
  }, [kind]);

  const finish = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    const { best, isNewBest } = saveDrillBest(kindRef.current, correctRef.current);
    setResult({
      correct: correctRef.current,
      wrong: wrongRef.current,
      accuracy: drillAccuracy(correctRef.current, wrongRef.current),
      best,
      isNewBest,
    });
    setMsLeft(0);
    go('finished');
    playMoveSound('success', mutedRef.current);
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) finish();
      else setMsLeft(left);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  const start = useCallback(() => {
    correctRef.current = 0;
    wrongRef.current = 0;
    setCorrect(0);
    setWrong(0);
    setLast(null);
    setResult(null);
    endAtRef.current = performance.now() + DRILL_DURATION_MS;
    setMsLeft(DRILL_DURATION_MS);
    const first = makeQuestion(kindRef.current);
    questionRef.current = first;
    setQuestion(first);
    go('running');
  }, []);

  const answer = useCallback((value: string) => {
    const q = questionRef.current;
    if (phaseRef.current !== 'running' || !q) return;
    if (endAtRef.current - performance.now() <= 0) return;
    const ok = value === q.answer;
    if (ok) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
      setLast({ ok: true, text: 'Correct' });
    } else {
      wrongRef.current += 1;
      setWrong(wrongRef.current);
      setLast({ ok: false, text: q.explanation });
    }
    playMoveSound(ok ? 'move' : 'error', mutedRef.current);
    const nextQuestion = makeQuestion(kindRef.current, Math.random, q);
    questionRef.current = nextQuestion;
    setQuestion(nextQuestion);
  }, []);

  // Keyboard: L/D, Y/N or 1-6, whatever the current question offers.
  useEffect(() => {
    if (phase !== 'running') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const option = questionRef.current?.options.find((o) => o.key === event.key.toLowerCase());
      if (option) {
        event.preventDefault();
        answer(option.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answer]);

  const backToSetup = useCallback(() => {
    questionRef.current = null;
    setQuestion(null);
    setResult(null);
    setLast(null);
    go('setup');
  }, []);

  const best = loadDrillBest(kind);
  const boardSizeClass = BOARD_SIZE_CLASS_MAP[appearance.boardSize] ?? 'max-w-[min(560px,100%)]';
  const lowTime = msLeft > 0 && msLeft <= 10_000;

  return (
    <TrainerLayout
      username={username}
      muted={muted}
      onToggleMute={onToggleMute}
      boardSizeClass={boardSizeClass}
      board={
        <div className="w-full aspect-square rounded-2xl bg-[#16233b] border border-white/10 flex flex-col items-center justify-center gap-3 p-6 text-center">
          {phase === 'running' && question ? (
            <>
              <p className="text-white/60 text-sm font-semibold">{drillLabel(question.kind)}</p>
              <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight" data-testid="question">
                {question.prompt}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-white tracking-tight">No board here</p>
              <p className="text-sm font-medium text-white/65 max-w-[320px] leading-relaxed">
                These drills train the board in your head. Pick a drill and press Start.
              </p>
            </>
          )}
        </div>
      }
      panel={
        <>
          {phase === 'setup' && (
            <div className={CARD_CLASS}>
              <ModeTabs mode={mode} onChange={onModeChange} />
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Visualization drills</h2>
                <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
                  60 seconds, no board. Answer as many questions as you can.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Drill</span>
                <div className="grid grid-cols-3 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
                  {DRILL_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={kind === k}
                      onClick={() => setKind(k)}
                      className={`${segmentClass(kind === k)} !whitespace-normal leading-tight`}
                    >
                      {drillLabel(k)}
                    </button>
                  ))}
                </div>
                <p className="text-sm font-medium text-white/75 leading-relaxed">{drillDescription(kind)}</p>
              </div>

              <p className="text-sm font-semibold text-white/75 tabular-nums">
                {best > 0 ? `Your best (${drillLabel(kind)}): ${best}` : 'No record yet for this drill.'}
              </p>

              <button type="button" onClick={start} className={PRIMARY_BUTTON_CLASS}>
                Start
              </button>
            </div>
          )}

          {phase === 'running' && question && (
            <div className={CARD_CLASS}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-white">Time left</span>
                <span
                  className={`text-2xl font-bold tabular-nums ${lowTime ? 'text-[#ff7a7a]' : 'text-white'}`}
                  data-testid="clock"
                >
                  {formatClock(msLeft)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="Correct" value={String(correct)} tone="good" />
                <StatTile label="Wrong" value={String(wrong)} tone="bad" />
              </div>

              <div
                className={`grid gap-2.5 ${question.options.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}
                role="group"
                aria-label="Answers"
              >
                {question.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => answer(option.value)}
                    className="py-4 rounded-xl bg-[#101b2f] border border-white/20 hover:border-[#39ff88] text-white text-lg font-bold cursor-pointer min-h-[56px] focus-visible:outline-2 focus-visible:outline-[#39ff88]"
                  >
                    {option.label}
                    <span className="sr-only"> (key {option.key.toUpperCase()})</span>
                  </button>
                ))}
              </div>

              <p
                className={`text-center text-sm font-semibold min-h-[20px] ${last && !last.ok ? 'text-[#ff7a7a]' : 'text-[#39ff88]'}`}
                aria-live="polite"
                data-testid="last"
              >
                {last ? (last.ok ? '✓ Correct' : `✗ ${last.text}`) : 'Keys: ' + question.options.map((o) => o.key.toUpperCase()).join(' / ')}
              </p>

              <button type="button" onClick={backToSetup} className={SECONDARY_BUTTON_CLASS}>
                End drill (not saved)
              </button>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className={CARD_CLASS} role="status" aria-live="polite">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-tight">Time’s up!</h2>
                <div
                  className="text-7xl font-bold text-[#39ff88] leading-none mt-4 tabular-nums"
                  data-testid="final-correct"
                >
                  {result.correct}
                </div>
                <div className="text-sm font-semibold text-white/70 mt-2">correct answers ({drillLabel(kind)})</div>
                {result.isNewBest && (
                  <div className="inline-block mt-3 px-3 py-1 rounded-full bg-[#39ff88]/15 border border-[#39ff88] text-[#39ff88] text-xs font-bold">
                    New best!
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Accuracy" value={`${result.accuracy}%`} />
                <StatTile label="Wrong" value={String(result.wrong)} tone="bad" />
                <StatTile label="Best" value={String(result.best)} tone="good" />
              </div>
              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={start} className={PRIMARY_BUTTON_CLASS}>
                  Play again
                </button>
                <button type="button" onClick={backToSetup} className={SECONDARY_BUTTON_CLASS}>
                  Change drill
                </button>
              </div>
            </div>
          )}
        </>
      }
    />
  );
}
