import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARD_CLASS,
  COMPACT_CARD_CLASS,
  SETUP_TEXT_CLASS,
  START_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StatTile,
  segmentClass,
} from '../../components/panelUi';
import TrainerLayout from '../../components/TrainerLayout';
import { GetPremiumLink, LOCKED_CLASS, LockMark, UnlockNotice, useLocks } from '../../components/locks';
import { useAuth } from '../../auth';
import { canOpenBlindfold, clampDrill, clampDrillLimit, tierFor, unlockHint } from '../../utils/access';
import { useAppearance } from '../../hooks/useAppearance';
import {
  DRILL_DURATION_MS,
  DRILL_LIMITS,
  drillAccuracy,
  drillLabel,
  drillLimitLabel,
  loadDrillBest,
  loadDrillKind,
  loadDrillLimit,
  makeQuestion,
  saveDrillBest,
  saveDrillKind,
  saveDrillLimit,
  secondsPerAnswer,
  typedInput,
  type DrillKind,
  type DrillLimit,
  type DrillQuestion,
  type QuestionKind,
} from '../../utils/drills';
import { formatClock } from '../../utils/clock';
import { recordActivity } from '../../utils/activity';
import { playMoveSound } from '../../utils/sound';
import Reconstruct from './Reconstruct';
import { DrillPicker, GuestStart, ModeTabs, type BlindfoldModeProps } from './shared';

type Phase = 'setup' | 'running' | 'finished';

interface DrillResult {
  correct: number;
  wrong: number;
  accuracy: number;
  best: number;
  isNewBest: boolean;
  /** Endless run: no record, and the time it took. */
  endless: boolean;
  ms: number;
}

const TICK_MS = 100;

export default function Drills({ username, mode, onModeChange }: BlindfoldModeProps) {
  const { tier } = useAuth();
  const [kind, setKind] = useState<DrillKind>(() => clampDrill(tier, loadDrillKind()));
  const [limit, setLimit] = useState<DrillLimit>(() => clampDrillLimit(tier, loadDrillLimit()));
  const limitLocks = useLocks(tier);
  const [appearance, setAppearance] = useAppearance();
  const [phase, setPhase] = useState<Phase>('setup');
  const [question, setQuestion] = useState<DrillQuestion | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [msLeft, setMsLeft] = useState(DRILL_DURATION_MS);
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<DrillResult | null>(null);
  /** What is typed in the answer box (the drills with a typed answer). */
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const phaseRef = useRef<Phase>('setup');
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const limitRef = useRef(limit);
  limitRef.current = limit;
  const startedAtRef = useRef(0);
  const questionRef = useRef<DrillQuestion | null>(null);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const endAtRef = useRef(0);

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
        'Chess visualization drills with no board to look at: square colors, check and attack questions, diagonals, knight routes, piece distances, counting squares, king and pawn endgames and following moves.',
      );
  }, []);

  // A drill saved earlier (or left open by signing out) may not be allowed now.
  useEffect(() => {
    const allowed = clampDrill(tier, kind);
    if (allowed !== kind) setKind(allowed);
  }, [tier, kind]);

  // Same for the run length: "No time limit" is Premium, so a saved one is taken back to the 1 minute run.
  useEffect(() => {
    const allowed = clampDrillLimit(tier, limit);
    if (allowed !== limit) setLimit(allowed);
  }, [tier, limit]);

  useEffect(() => {
    saveDrillKind(kind);
  }, [kind]);

  useEffect(() => {
    saveDrillLimit(limit);
  }, [limit]);

  const finish = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    const endless = limitRef.current === 'endless';
    const ms = endless ? Math.max(0, Math.round(performance.now() - startedAtRef.current)) : DRILL_DURATION_MS;
    // The minute run has a record; the endless run is practice and keeps none.
    const { best, isNewBest } = endless
      ? { best: 0, isNewBest: false }
      : saveDrillBest(kindRef.current, correctRef.current);
    recordActivity({
      mode: 'drills',
      ms,
      correct: correctRef.current,
      wrong: wrongRef.current,
    });
    setResult({
      correct: correctRef.current,
      wrong: wrongRef.current,
      accuracy: drillAccuracy(correctRef.current, wrongRef.current),
      best,
      isNewBest,
      endless,
      ms,
    });
    setMsLeft(0);
    go('finished');
    playMoveSound('success');
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      if (limitRef.current === 'endless') {
        setMsLeft(performance.now() - startedAtRef.current); // the clock counts up
        return;
      }
      const left = endAtRef.current - performance.now();
      if (left <= 0) finish();
      else setMsLeft(left);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  const start = useCallback(() => {
    if (!canOpenBlindfold(tier)) return;
    correctRef.current = 0;
    wrongRef.current = 0;
    setCorrect(0);
    setWrong(0);
    setLast(null);
    setResult(null);
    startedAtRef.current = performance.now();
    endAtRef.current = limitRef.current === 'endless' ? Infinity : startedAtRef.current + DRILL_DURATION_MS;
    setMsLeft(limitRef.current === 'endless' ? 0 : DRILL_DURATION_MS);
    const first = makeQuestion(kindRef.current as QuestionKind);
    questionRef.current = first;
    setQuestion(first);
    setTyped('');
    go('running');
  }, [tier]);

  const answer = useCallback((value: string) => {
    const q = questionRef.current;
    if (phaseRef.current !== 'running' || !q) return;
    if (endAtRef.current - performance.now() <= 0) return;
    const ok = (q.entry ? typedInput(q.entry, value) : value) === q.answer;
    if (ok) {
      correctRef.current += 1;
      setCorrect(correctRef.current);
      setLast({ ok: true, text: 'Correct' });
    } else {
      wrongRef.current += 1;
      setWrong(wrongRef.current);
      setLast({ ok: false, text: q.explanation });
    }
    playMoveSound(ok ? 'move' : 'error');
    const nextQuestion = makeQuestion(kindRef.current as QuestionKind, Math.random, q);
    questionRef.current = nextQuestion;
    setQuestion(nextQuestion);
    setTyped('');
  }, []);

  // A typed answer: a square is sent as soon as it is complete, a number with Enter (or the OK button).
  const onType = useCallback(
    (raw: string) => {
      const entry = questionRef.current?.entry;
      if (!entry) return;
      const value = typedInput(entry, raw);
      if (entry === 'square' && value.length === 2) answer(value);
      else setTyped(value);
    },
    [answer],
  );

  // The cursor goes to the answer box with every typed question, so the keyboard is all you need.
  useEffect(() => {
    if (phase === 'running' && question?.entry) inputRef.current?.focus();
  }, [phase, question]);

  // Keyboard: L/D, Y/N or 1-6, whatever the current question offers.
  useEffect(() => {
    if (phase !== 'running') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement) return;
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
    setTyped('');
    go('setup');
  }, []);

  // The rebuild drill is not a run of quick questions: it has its own page (and its own picker).
  if (kind === 'reconstruct') {
    return <Reconstruct username={username} mode={mode} onModeChange={onModeChange} kind={kind} onKindChange={setKind} />;
  }

  const best = loadDrillBest(kind);
  const endless = limit === 'endless';
  const lowTime = !endless && msLeft > 0 && msLeft <= 10_000;

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={
        <div className="w-full aspect-square rounded-2xl bg-[#16233b] border border-white/10 flex flex-col items-center justify-center gap-3 p-6 text-center">
          {phase === 'running' && question ? (
            <>
              <p className="text-white/60 text-sm font-semibold">{drillLabel(question.kind)}</p>
              {question.lead && (
                <p className="text-xl sm:text-2xl font-semibold text-white/85 tracking-tight leading-snug" data-testid="lead">
                  {question.lead}
                </p>
              )}
              <p
                className={`${question.prompt.length > 48 ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'} font-bold text-white tracking-tight`}
                data-testid="question"
              >
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
            <div className={COMPACT_CARD_CLASS}>
              <ModeTabs mode={mode} onChange={onModeChange} />
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Visualization drills</h2>
                <p className={SETUP_TEXT_CLASS}>
                  {limit === 'minute'
                    ? '60 seconds, no board. Answer as many questions as you can.'
                    : 'No board and no time limit. Answer for as long as you like, then finish.'}
                </p>
              </div>

              <DrillPicker kind={kind} onChange={setKind} />

              <div className="space-y-1.5">
                <span className="text-sm font-semibold text-white">Time</span>
                <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
                  {DRILL_LIMITS.map((l) => {
                    const needs = tierFor((a) => a.blindfold.drillLimits, l);
                    const locked = limitLocks.isLocked(needs);
                    return (
                      <button
                        key={l}
                        type="button"
                        data-testid={`limit-${l}`}
                        aria-pressed={limit === l}
                        aria-disabled={locked || undefined}
                        title={locked ? unlockHint(tier, needs) : undefined}
                        onClick={limitLocks.choose(l === 'endless' ? 'No time limit' : 'The 1 minute run', needs, () => setLimit(l))}
                        className={`${segmentClass(limit === l, true)} ${locked ? LOCKED_CLASS : ''}`}
                      >
                        {drillLimitLabel(l)}
                        {locked && <LockMark />}
                      </button>
                    );
                  })}
                </div>
                <UnlockNotice notice={limitLocks.notice} />
              </div>
              <GetPremiumLink tier={tier} />

              <p className="text-[13px] font-semibold text-white/75 tabular-nums leading-snug">
                {limit === 'endless'
                  ? 'Practice mode: your answers count in Statistics, but there is no record.'
                  : best > 0
                    ? `Your best (${drillLabel(kind)}): ${best}`
                    : 'No record yet for this drill.'}
              </p>

              {canOpenBlindfold(tier) ? (
                <button type="button" onClick={start} className={START_BUTTON_CLASS}>
                  Start
                </button>
              ) : (
                <GuestStart />
              )}
            </div>
          )}

          {phase === 'running' && question && (
            <div className={CARD_CLASS}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-white">{endless ? 'Time' : 'Time left'}</span>
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

              {question.entry ? (
                <form
                  className="flex gap-2.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (typed !== '') answer(typed);
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={typed}
                    onChange={(event) => onType(event.target.value)}
                    inputMode={question.entry === 'number' ? 'numeric' : 'text'}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={question.entry === 'number' ? 3 : 4}
                    placeholder={question.entry === 'number' ? 'Number' : 'Square, e.g. f3'}
                    aria-label={question.entry === 'number' ? 'Your answer (a number)' : 'Your answer (a square, such as f3)'}
                    data-testid="answer-input"
                    className="flex-1 min-w-0 rounded-xl bg-[#101b2f] border border-white/20 focus:border-[#39ff88] text-white text-2xl font-bold text-center px-3 min-h-[56px] outline-none placeholder:text-white/35 placeholder:text-base placeholder:font-semibold"
                  />
                  <button
                    type="submit"
                    data-testid="answer-submit"
                    className="px-6 rounded-xl bg-[#101b2f] border border-white/20 hover:border-[#39ff88] text-white text-lg font-bold cursor-pointer min-h-[56px] focus-visible:outline-2 focus-visible:outline-[#39ff88]"
                  >
                    OK
                  </button>
                </form>
              ) : (
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
              )}

              <p
                className={`text-center text-sm font-semibold min-h-[20px] ${last && !last.ok ? 'text-[#ff7a7a]' : 'text-[#39ff88]'}`}
                aria-live="polite"
                data-testid="last"
              >
                {last
                  ? last.ok
                    ? '✓ Correct'
                    : `✗ ${last.text}`
                  : question.entry === 'number'
                    ? 'Type the number, then press Enter'
                    : question.entry === 'square'
                      ? 'Type the square, for example f3'
                      : 'Keys: ' + question.options.map((o) => o.key.toUpperCase()).join(' / ')}
              </p>

              {endless && (
                <button type="button" data-testid="finish-drill" onClick={finish} className={PRIMARY_BUTTON_CLASS}>
                  Finish and save
                </button>
              )}
              <button type="button" onClick={backToSetup} className={SECONDARY_BUTTON_CLASS}>
                End drill (not saved)
              </button>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className={CARD_CLASS} role="status" aria-live="polite">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {result.endless ? 'Drill finished' : 'Time’s up!'}
                </h2>
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
                {result.endless ? (
                  <StatTile
                    label="Per answer"
                    value={`${secondsPerAnswer(result.ms, result.correct + result.wrong)} s`}
                  />
                ) : (
                  <StatTile label="Best" value={String(result.best)} tone="good" />
                )}
              </div>
              {result.endless && (
                <p className="text-center text-sm font-semibold text-white/70" data-testid="endless-time">
                  {formatClock(result.ms)} in total. Practice runs keep no record.
                </p>
              )}
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
