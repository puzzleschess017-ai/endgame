import { useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'chessground/types';
import {
  CARD_CLASS,
  COMPACT_CARD_CLASS,
  SEGMENT_FRAME_CLASS,
  SETUP_CARD_CLASS,
  SETUP_TEXT_CLASS,
  SettingRow,
  START_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StatTile,
  segmentClass,
} from '../../components/panelUi';
import TrainerLayout from '../../components/TrainerLayout';
import { UnlockLinks, LOCKED_CLASS, LockMark, UnlockNotice, useLocks } from '../../components/locks';
import { authHeaders, useAuth } from '../../auth';
import { canOpenBlindfold, clampBlindfold, tierFor, unlockHint } from '../../utils/access';
import { useAppearance } from '../../hooks/useAppearance';
import {
  BLINDFOLD_LEVELS,
  EMPTY_FEN,
  MATE_IN_OPTIONS,
  MEMORIZE_OPTIONS,
  ROUND_SIZE,
  checkStep,
  fetchBlindfoldRound,
  levelDescription,
  levelLabel,
  loadBlindfoldBest,
  loadBlindfoldSettings,
  saveBlindfoldBest,
  saveBlindfoldSettings,
  solutionLine,
  stepView,
  type BlindfoldItem,
  type BlindfoldSettings,
} from '../../utils/blindfold';
import { recordActivity } from '../../utils/activity';
import { playMoveSound } from '../../utils/sound';
import { GuestStart, ModeTabs, ViewBoard, type BlindfoldModeProps } from './shared';

type Phase = 'setup' | 'loading' | 'memorize' | 'answer' | 'feedback' | 'finished';

interface Feedback {
  kind: 'correct' | 'wrong' | 'gaveup';
  typedSan?: string;
}

interface RoundResult {
  correct: number;
  total: number;
  best: number;
  isNewBest: boolean;
}

const TICK_MS = 100;

export default function Mate({ username, mode, onModeChange }: BlindfoldModeProps) {
  const { tier } = useAuth();
  const locks = useLocks(tier);
  const [settings, setSettings] = useState<BlindfoldSettings>(() => ({
    ...loadBlindfoldSettings(),
    ...clampBlindfold(tier, loadBlindfoldSettings()),
  }));
  const [appearance, setAppearance] = useAppearance();

  const [phase, setPhase] = useState<Phase>('setup');
  const [items, setItems] = useState<BlindfoldItem[]>([]);
  const [index, setIndex] = useState(0);
  // Longer mates: which of the player's moves is asked now (0 is the first), and the moves played so far.
  const [step, setStep] = useState(0);
  const [played, setPlayed] = useState<string[]>([]);
  const [correct, setCorrect] = useState(0);
  const [msLeft, setMsLeft] = useState(0);
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncToken, setSyncToken] = useState(0);

  const phaseRef = useRef<Phase>('setup');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const runIdRef = useRef(0);
  const itemsRef = useRef<BlindfoldItem[]>([]);
  const correctRef = useRef(0);
  const endAtRef = useRef(0);
  const roundStartedAtRef = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement | null>(null);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
    setSyncToken((t) => t + 1);
  };

  useEffect(() => {
    document.title = 'Blindfold Chess Training | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Blindfold chess training: memorize the position, then find the checkmate in one, two or three moves without seeing the pieces.',
      );
  }, []);

  // Settings saved earlier (or left open by signing out) may not be allowed now.
  useEffect(() => {
    const allowed = clampBlindfold(tier, settings);
    if (allowed.level !== settings.level || allowed.memorize !== settings.memorize || allowed.mateIn !== settings.mateIn) {
      setSettings({ ...settings, ...allowed });
    }
  }, [tier, settings]);

  useEffect(() => {
    saveBlindfoldSettings(settings);
  }, [settings]);

  const hidePieces = useCallback(() => {
    if (phaseRef.current !== 'memorize') return;
    setText('');
    setHint(null);
    go('answer');
  }, []);

  const beginMemorize = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    setStep(0);
    setPlayed([]);
    setText('');
    setHint(null);
    setFeedback(null);
    const ms = settingsRef.current.memorize * 1000;
    endAtRef.current = performance.now() + ms;
    setMsLeft(ms);
    go('memorize');
  }, []);

  // Countdown while the position is visible.
  useEffect(() => {
    if (phase !== 'memorize') return;
    const id = window.setInterval(() => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) hidePieces();
      else setMsLeft(left);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, hidePieces]);

  // The answer box is ready as soon as the pieces disappear.
  useEffect(() => {
    if (phase === 'answer') inputRef.current?.focus();
  }, [phase]);

  const closed = !canOpenBlindfold(tier);

  const startRound = useCallback(async () => {
    if (phaseRef.current === 'loading' || closed) return;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    setError(null);
    setResult(null);
    setCorrect(0);
    correctRef.current = 0;
    go('loading');
    try {
      const round = await fetchBlindfoldRound(
        settingsRef.current.level,
        ROUND_SIZE,
        fetch,
        authHeaders(),
        settingsRef.current.mateIn,
      );
      if (runId !== runIdRef.current) return;
      itemsRef.current = round;
      roundStartedAtRef.current = Date.now();
      setItems(round);
      beginMemorize(0);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load puzzles. Check your connection.');
      go('setup');
    }
  }, [beginMemorize, closed]);

  const finishRound = useCallback(() => {
    const total = itemsRef.current.length;
    const { best, isNewBest } = saveBlindfoldBest(
      settingsRef.current.level,
      correctRef.current,
      settingsRef.current.mateIn,
    );
    recordActivity({
      mode: 'blindfold',
      ms: Date.now() - roundStartedAtRef.current,
      correct: correctRef.current,
      wrong: Math.max(0, total - correctRef.current),
      puzzles: correctRef.current,
    });
    setResult({ correct: correctRef.current, total, best, isNewBest });
    go('finished');
    playMoveSound('success');
  }, []);

  const current = items[index];

  const settle = (kind: Feedback['kind'], typedSan?: string) => {
    if (kind === 'correct') {
      correctRef.current += 1;
      setCorrect(correctRef.current);
      playMoveSound('success');
    } else {
      playMoveSound('error');
    }
    setFeedback({ kind, typedSan });
    go('feedback');
  };

  const submit = () => {
    if (phaseRef.current !== 'answer' || !current) return;
    const view = stepView(current.position, step);
    const answer = checkStep(view.fen, text, view.expectedUci);
    if (answer.kind === 'empty') return;
    if (answer.kind === 'illegal') {
      setHint('That is not a legal move here. Check the notation (for example Qh7# or Rxe8) and try again.');
      return;
    }
    setHint(null);
    if (answer.kind === 'mate') {
      settle('correct', answer.san);
    } else if (answer.kind === 'wrong') {
      settle('wrong', answer.san);
    } else {
      // The right move, but the game goes on: the opponent answers (shown as text) and the next move is asked.
      const reply = current.position.solution[step * 2 + 1];
      setPlayed((list) => [...list, answer.san, reply.san]);
      setStep(step + 1);
      setText('');
      playMoveSound('move');
    }
  };

  const giveUp = () => {
    if (phaseRef.current !== 'answer') return;
    settle('gaveup');
  };

  const next = () => {
    if (phaseRef.current !== 'feedback') return;
    if (index + 1 >= items.length) finishRound();
    else beginMemorize(index + 1);
  };

  const backToSetup = useCallback(() => {
    runIdRef.current += 1;
    setItems([]);
    itemsRef.current = [];
    setResult(null);
    setError(null);
    setFeedback(null);
    setStep(0);
    setPlayed([]);
    go('setup');
  }, []);

  const best = loadBlindfoldBest(settings.level, settings.mateIn);
  const longMate = settings.mateIn > 1;
  const sideName = current ? (current.position.playerColor === 'white' ? 'White' : 'Black') : '';
  const running = phase === 'memorize' || phase === 'answer' || phase === 'feedback';

  // Before a round the board is empty, as in Coordinate Training: in blindfold chess you do not see the pieces.
  let boardFen = EMPTY_FEN;
  let orientation: 'white' | 'black' = 'white';
  let lastMove: [Key, Key] | undefined;
  let arrow: [Key, Key] | null = null;
  if (current && running) {
    orientation = current.position.playerColor;
    if (phase === 'answer') {
      boardFen = EMPTY_FEN;
    } else {
      // While memorizing (step 0) and at the end: the position the player faced, with the wanted move.
      const view = stepView(current.position, step);
      boardFen = view.fen;
      lastMove = view.lastMove;
      if (phase === 'feedback') {
        arrow = [view.expectedUci.slice(0, 2) as Key, view.expectedUci.slice(2, 4) as Key];
      }
    }
  }

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={
        <ViewBoard
          fen={boardFen}
          orientation={orientation}
          lastMove={lastMove}
          arrow={arrow}
          syncToken={syncToken}
          boardTheme={appearance.boardTheme}
          pieceSet={appearance.pieceSet}
        />
      }
      panel={
        <>
          {(phase === 'setup' || phase === 'loading') && (
            <div className={SETUP_CARD_CLASS}>
              <ModeTabs mode={mode} onChange={onModeChange} />
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Blindfold: mate in {settings.mateIn}</h2>
                <p className={SETUP_TEXT_CLASS}>
                  {longMate ? (
                    <>
                      Memorize the position. Then the pieces vanish and you type your moves one at a time, for
                      example <span className="font-bold text-white">Qh7+</span>. After each right move the
                      reply is shown as text, and you keep the position in your head until the checkmate.
                    </>
                  ) : (
                    <>
                      Memorize the position. Then the pieces vanish and you type the checkmating move, for
                      example <span className="font-bold text-white">Qh7#</span>.
                    </>
                  )}
                </p>
              </div>

              <SettingRow label="Mate in">
                <div className={`grid grid-cols-3 ${SEGMENT_FRAME_CLASS}`}>
                  {MATE_IN_OPTIONS.map((moves) => {
                    const needs = tierFor((a) => a.blindfold.mateIn, moves);
                    const locked = locks.isLocked(needs);
                    return (
                      <button
                        key={moves}
                        type="button"
                        data-testid={`mate-in-${moves}`}
                        aria-pressed={settings.mateIn === moves}
                        aria-disabled={locked || undefined}
                        title={locked ? unlockHint(tier, needs) : undefined}
                        disabled={phase === 'loading'}
                        onClick={locks.choose(`Mate in ${moves}`, needs, () => setSettings({ ...settings, mateIn: moves }))}
                        className={`${segmentClass(settings.mateIn === moves, true, true)} ${locked ? LOCKED_CLASS : ''}`}
                      >
                        {moves}
                        {locked && <LockMark small />}
                      </button>
                    );
                  })}
                </div>
              </SettingRow>

              <SettingRow label="Pieces">
                <div className={`grid grid-cols-5 ${SEGMENT_FRAME_CLASS}`}>
                  {BLINDFOLD_LEVELS.map((level) => {
                    const needs = tierFor((a) => a.blindfold.levels, level);
                    const locked = locks.isLocked(needs);
                    return (
                      <button
                        key={level}
                        type="button"
                        data-testid={`level-${level}`}
                        aria-pressed={settings.level === level}
                        aria-disabled={locked || undefined}
                        title={locked ? unlockHint(tier, needs) : undefined}
                        disabled={phase === 'loading'}
                        onClick={locks.choose(levelDescription(level), needs, () => setSettings({ ...settings, level }))}
                        className={`${segmentClass(settings.level === level, true, true)} ${locked ? LOCKED_CLASS : ''}`}
                        aria-label={levelDescription(level)}
                      >
                        {level === 32 ? 'Any' : `≤ ${level}`}
                        {locked && <LockMark small />}
                      </button>
                    );
                  })}
                </div>
              </SettingRow>

              <SettingRow label="Memorize">
                <div className={`grid grid-cols-3 ${SEGMENT_FRAME_CLASS}`}>
                  {MEMORIZE_OPTIONS.map((seconds) => {
                    const needs = tierFor((a) => a.blindfold.memorize, seconds);
                    const locked = locks.isLocked(needs);
                    return (
                      <button
                        key={seconds}
                        type="button"
                        data-testid={`memorize-${seconds}`}
                        aria-pressed={settings.memorize === seconds}
                        aria-disabled={locked || undefined}
                        title={locked ? unlockHint(tier, needs) : undefined}
                        disabled={phase === 'loading'}
                        onClick={locks.choose(`${seconds} seconds to memorize`, needs, () => setSettings({ ...settings, memorize: seconds }))}
                        className={`${segmentClass(settings.memorize === seconds, true, true)} ${locked ? LOCKED_CLASS : ''}`}
                      >
                        {seconds} s
                        {locked && <LockMark small />}
                      </button>
                    );
                  })}
                </div>
              </SettingRow>

              <UnlockNotice notice={locks.notice} />
              <UnlockLinks tier={tier} accountLink={false} />

              {error && (
                <div
                  role="alert"
                  className="text-sm font-medium text-[#ffd2cc] bg-[#401a22] border border-[#8f3848] rounded-xl px-3.5 py-2.5"
                >
                  {error}
                </div>
              )}

              <p className="text-[13px] font-semibold text-white/75 tabular-nums leading-snug">
                {best > 0
                  ? `Your best (${longMate ? `mate in ${settings.mateIn}, ` : ''}${levelDescription(settings.level)}): ${best}/${ROUND_SIZE}`
                  : `A round is ${ROUND_SIZE} puzzles. No record yet for this level.`}
              </p>

              {closed ? (
                <GuestStart />
              ) : (
                <button
                  type="button"
                  onClick={() => void startRound()}
                  disabled={phase === 'loading'}
                  className={START_BUTTON_CLASS}
                >
                  {phase === 'loading' ? 'Loading puzzles…' : 'Start'}
                </button>
              )}
            </div>
          )}

          {running && current && (
            <div className={CARD_CLASS}>
              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Puzzle" value={`${index + 1}/${items.length}`} />
                <StatTile label="Correct" value={String(correct)} tone="good" />
                <StatTile label="Pieces" value={String(current.position.pieceCount)} />
              </div>

              {phase === 'memorize' && (
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-white">Memorize the position</span>
                      <span className="text-2xl font-bold tabular-nums text-white" data-testid="memorize-clock">
                        {Math.ceil(msLeft / 1000)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#101b2f] overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full bg-[#39ff88]"
                        style={{ width: `${Math.max(0, Math.min(100, (msLeft / (settings.memorize * 1000)) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white/80" data-testid="status">
                    {sideName} to move and mate in {current.position.mateIn}.
                  </p>
                  <button type="button" onClick={hidePieces} className={SECONDARY_BUTTON_CLASS}>
                    I’m ready, hide the pieces
                  </button>
                </div>
              )}

              {phase === 'answer' && (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  <p className="text-sm font-semibold text-white/80" data-testid="status">
                    {longMate
                      ? `${sideName} to move. Move ${step + 1} of ${current.position.mateIn}: type your move.`
                      : `${sideName} to move. Type the checkmate.`}
                  </p>
                  {played.length > 0 && (
                    <p className="text-sm font-medium text-white/75" data-testid="played">
                      Moves so far: <span className="font-bold text-white">{played.join(' ')}</span>. The opponent
                      replied <span className="font-bold text-white">{played[played.length - 1]}</span>.
                    </p>
                  )}
                  <label className="sr-only" htmlFor="blindfold-answer">
                    Your move
                  </label>
                  <input
                    id="blindfold-answer"
                    ref={inputRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setHint(null);
                    }}
                    type="text"
                    inputMode="text"
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={longMate && step < current.position.mateIn - 1 ? 'Your move, e.g. Qh7+' : 'Your move, e.g. Qh7#'}
                    className="w-full px-4 py-3 rounded-xl bg-[#101b2f] border border-white/20 focus:border-[#39ff88] outline-none text-white text-lg font-semibold tracking-tight placeholder:text-white/40 placeholder:text-base placeholder:font-medium min-h-[48px]"
                  />
                  {hint && (
                    <p role="alert" className="text-sm font-medium text-[#ffd2cc]" data-testid="hint">
                      {hint}
                    </p>
                  )}
                  <button type="submit" disabled={!text.trim()} className={`${PRIMARY_BUTTON_CLASS} btn-still`}>
                    Check
                  </button>
                  <button type="button" onClick={giveUp} className={SECONDARY_BUTTON_CLASS}>
                    Give up and show the answer
                  </button>
                </form>
              )}

              {phase === 'feedback' && feedback && (
                <div className="flex flex-col gap-3">
                  <p
                    className={`text-lg font-bold ${feedback.kind === 'correct' ? 'text-[#39ff88]' : 'text-[#ff7a7a]'}`}
                    data-testid="status"
                  >
                    {feedback.kind === 'correct'
                      ? `Correct! ${feedback.typedSan}`
                      : feedback.kind === 'wrong'
                        ? longMate
                          ? `Not the right move (${feedback.typedSan}).`
                          : `Not mate (${feedback.typedSan}).`
                        : 'The answer was:'}
                  </p>
                  {feedback.kind !== 'correct' && (
                    <p className="text-sm font-semibold text-white/85">
                      {longMate ? 'The solution was ' : 'The mate was '}
                      <span className="font-bold text-white" data-testid="mate-move">
                        {longMate ? solutionLine(current.position) : current.position.mateSan}
                      </span>
                    </p>
                  )}
                  {longMate && feedback.kind === 'wrong' && (
                    <p className="text-xs font-medium text-white/60">
                      Another winning line may exist, but this trainer follows the puzzle’s own solution (any
                      checkmate is always accepted).
                    </p>
                  )}
                  <button type="button" onClick={next} autoFocus className={`${PRIMARY_BUTTON_CLASS} btn-still`}>
                    {index + 1 >= items.length ? 'See result' : 'Next puzzle'}
                  </button>
                </div>
              )}

              <button type="button" onClick={backToSetup} className={SECONDARY_BUTTON_CLASS}>
                End round (not saved)
              </button>
            </div>
          )}

          {phase === 'finished' && result && (
            <div className={CARD_CLASS} role="status" aria-live="polite">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white tracking-tight">Round complete</h2>
                <div
                  className="text-7xl font-bold text-[#39ff88] leading-none mt-4 tabular-nums"
                  data-testid="final-score"
                >
                  {result.correct}/{result.total}
                </div>
                <div className="text-sm font-semibold text-white/70 mt-2">
                  {longMate ? `mates in ${settings.mateIn} found` : 'checkmates found'} ({levelDescription(settings.level)})
                </div>
                {result.isNewBest && (
                  <div className="inline-block mt-3 px-3 py-1 rounded-full bg-[#39ff88]/15 border border-[#39ff88] text-[#39ff88] text-xs font-bold">
                    New best!
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile label="Level" value={levelLabel(settings.level) === 'Any' ? 'Any' : `≤ ${settings.level}`} />
                <StatTile label="Best" value={`${result.best}/${ROUND_SIZE}`} tone="good" />
              </div>
              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={() => void startRound()} className={PRIMARY_BUTTON_CLASS}>
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
