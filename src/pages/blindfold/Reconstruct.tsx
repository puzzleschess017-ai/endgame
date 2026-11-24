import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Eraser, Hand, Trash2 } from 'lucide-react';
import ChessboardPanel from '../../components/ChessboardPanel';
import {
  CARD_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StatTile,
  segmentClass,
} from '../../components/panelUi';
import TrainerLayout from '../../components/TrainerLayout';
import { authHeaders } from '../../auth';
import { useAppearance } from '../../hooks/useAppearance';
import { PREVIEW_FEN } from '../../hooks/usePuzzleSolver';
import { fetchBlindfoldRound, levelDescription, type BlindfoldItem } from '../../utils/blindfold';
import { recordActivity } from '../../utils/activity';
import { EMPTY_PLACEMENT } from '../../utils/editor';
import type { DrillKind } from '../../utils/drills';
import {
  RECONSTRUCT_LEVELS,
  RECONSTRUCT_ROUND,
  RECONSTRUCT_SECONDS,
  comparePlacement,
  loadReconstructBest,
  loadReconstructSettings,
  saveReconstructBest,
  saveReconstructSettings,
  shortNames,
  type Comparison,
  type ReconstructSettings,
} from '../../utils/reconstruct';
import { playMoveSound } from '../../utils/sound';
import { DrillPicker, ModeTabs, ViewBoard, type BlindfoldModeProps } from './shared';

type Phase = 'setup' | 'loading' | 'memorize' | 'build' | 'feedback' | 'finished';
type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';
type Tool = 'pointer' | 'trash' | PieceCode;

const ROLES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' } as const;
const WHITE_PIECES: PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'];
const BLACK_PIECES: PieceCode[] = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const PIECE_NAMES: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
const NO_DESTS = new Map<Key, Key[]>();
const noop = () => {};
const TICK_MS = 100;

function pieceOfCode(code: PieceCode) {
  return { color: code[0] === 'w' ? ('white' as const) : ('black' as const), role: ROLES[code[1] as keyof typeof ROLES] };
}

function pieceLabel(code: PieceCode): string {
  return `${code[0] === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[code[1]]}`;
}

function placementOf(fen: string): string {
  return fen.split(' ')[0];
}

function countPieces(placement: string): number {
  return placement.replace(/[^a-zA-Z]/g, '').length;
}

interface Outcome {
  comparison: Comparison;
}

interface RoundResult {
  perfect: number;
  piecesRight: number;
  piecesTotal: number;
  best: number;
  isNewBest: boolean;
}

interface ReconstructProps extends BlindfoldModeProps {
  kind: DrillKind;
  onKindChange: (kind: DrillKind) => void;
}

/**
 * "Rebuild position": a real position is shown for a few seconds, then the board is emptied and the player
 * puts the pieces back (drag them in from the palette, or pick a piece and tap squares).
 */
export default function Reconstruct({ username, mode, onModeChange, kind, onKindChange }: ReconstructProps) {
  const [appearance, setAppearance] = useAppearance();
  const [settings, setSettings] = useState<ReconstructSettings>(() => loadReconstructSettings());
  const [phase, setPhase] = useState<Phase>('setup');
  const [items, setItems] = useState<BlindfoldItem[]>([]);
  const [index, setIndex] = useState(0);
  const [msLeft, setMsLeft] = useState(0);
  const [placement, setPlacement] = useState(EMPTY_PLACEMENT);
  const [tool, setTool] = useState<Tool>('pointer');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [perfect, setPerfect] = useState(0);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<Phase>('setup');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const runIdRef = useRef(0);
  const itemsRef = useRef<BlindfoldItem[]>([]);
  const perfectRef = useRef(0);
  const rightRef = useRef(0);
  const totalRef = useRef(0);
  const endAtRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const apiRef = useRef<Api | null>(null);
  const toolRef = useRef<Tool>('pointer');
  toolRef.current = tool;
  const placementRef = useRef(EMPTY_PLACEMENT);
  placementRef.current = placement;

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    document.title = 'Rebuild the Position, Blindfold Drill | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Blindfold chess drill: memorize a real position for a few seconds, then rebuild it from memory on an empty board.',
      );
  }, []);

  useEffect(() => {
    saveReconstructSettings(settings);
  }, [settings]);

  const hidePieces = useCallback(() => {
    if (phaseRef.current !== 'memorize') return;
    setPlacement(EMPTY_PLACEMENT);
    setTool('pointer');
    go('build');
  }, []);

  const beginMemorize = useCallback((nextIndex: number) => {
    setIndex(nextIndex);
    setOutcome(null);
    setPlacement(EMPTY_PLACEMENT);
    const ms = settingsRef.current.seconds * 1000;
    endAtRef.current = performance.now() + ms;
    setMsLeft(ms);
    go('memorize');
  }, []);

  useEffect(() => {
    if (phase !== 'memorize') return;
    const id = window.setInterval(() => {
      const left = endAtRef.current - performance.now();
      if (left <= 0) hidePieces();
      else setMsLeft(left);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [phase, hidePieces]);

  const startRound = useCallback(async () => {
    if (phaseRef.current === 'loading') return;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    setError(null);
    setResult(null);
    setPerfect(0);
    perfectRef.current = 0;
    rightRef.current = 0;
    totalRef.current = 0;
    go('loading');
    try {
      const round = await fetchBlindfoldRound(settingsRef.current.level, RECONSTRUCT_ROUND, fetch, authHeaders(), 1);
      if (runId !== runIdRef.current) return;
      itemsRef.current = round;
      startedAtRef.current = Date.now();
      setItems(round);
      beginMemorize(0);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load positions. Check your connection.');
      go('setup');
    }
  }, [beginMemorize]);

  const finishRound = useCallback(() => {
    const total = itemsRef.current.length;
    const level = settingsRef.current.level;
    const { best, isNewBest } = saveReconstructBest(level, perfectRef.current);
    recordActivity({
      mode: 'drills',
      ms: Date.now() - startedAtRef.current,
      correct: perfectRef.current,
      wrong: Math.max(0, total - perfectRef.current),
    });
    setResult({
      perfect: perfectRef.current,
      piecesRight: rightRef.current,
      piecesTotal: totalRef.current,
      best,
      isNewBest,
    });
    go('finished');
    playMoveSound('success');
  }, []);

  const current = items[index];
  const real = current ? placementOf(current.position.fen) : EMPTY_PLACEMENT;

  const check = () => {
    if (phaseRef.current !== 'build' || !current) return;
    const comparison = comparePlacement(real, placementRef.current);
    rightRef.current += comparison.correct;
    totalRef.current += comparison.total;
    if (comparison.perfect) {
      perfectRef.current += 1;
      setPerfect(perfectRef.current);
      playMoveSound('success');
    } else {
      playMoveSound('error');
    }
    setOutcome({ comparison });
    go('feedback');
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
    setOutcome(null);
    go('setup');
  }, []);

  /** The board changed (a piece was moved, dragged in or dragged off). */
  const handleBoardChange = (next: string) => setPlacement((p) => (p === next ? p : next));

  /** A square was pressed: put the piece of the chosen tool there (the same piece again takes it off). */
  const handleSquare = (key: Key) => {
    const api = apiRef.current;
    const chosen = toolRef.current;
    if (!api || chosen === 'pointer') return;
    const here = api.state.pieces.get(key);
    if (chosen === 'trash') {
      if (!here) return;
      api.setPieces(new Map([[key, undefined]]));
    } else {
      const piece = pieceOfCode(chosen);
      const same = here && here.color === piece.color && here.role === piece.role;
      api.setPieces(new Map([[key, same ? undefined : piece]]));
    }
    handleBoardChange(api.getFen().split(' ')[0]);
  };

  const startDragFromPalette = (code: PieceCode, event: ReactMouseEvent | ReactTouchEvent) => {
    setTool(code);
    apiRef.current?.dragNewPiece(pieceOfCode(code), event.nativeEvent as MouseEvent, true);
  };

  const best = loadReconstructBest(settings.level);
  const running = phase === 'memorize' || phase === 'build' || phase === 'feedback';
  const orientation = current && running ? current.position.playerColor : 'white';

  let board: React.ReactNode;
  if (current && phase === 'memorize') {
    board = (
      <ViewBoard
        fen={current.position.fen}
        orientation={orientation}
        syncToken={index}
        boardTheme={appearance.boardTheme}
        pieceSet={appearance.pieceSet}
      />
    );
  } else if (current && phase === 'feedback') {
    board = (
      <ViewBoard
        fen={current.position.fen}
        orientation={orientation}
        syncToken={index + 100}
        boardTheme={appearance.boardTheme}
        pieceSet={appearance.pieceSet}
      />
    );
  } else if (current && phase === 'build') {
    board = (
      <ChessboardPanel
        key={`build-${index}`}
        fen={`${placement} w - - 0 1`}
        orientation={orientation}
        turnColor="white"
        dests={NO_DESTS}
        check={false}
        hintArrow={null}
        viewOnly={false}
        syncToken={0}
        boardTheme={appearance.boardTheme}
        pieceSet={appearance.pieceSet}
        onUserMove={noop}
        pendingPromotion={null}
        onSelectPromotion={noop}
        onCancelPromotion={noop}
        edit={{ onChange: handleBoardChange, apiRef, onSquare: handleSquare, dragEnabled: tool === 'pointer' }}
      />
    );
  } else {
    board = (
      <ViewBoard
        fen={PREVIEW_FEN}
        orientation="white"
        syncToken={0}
        boardTheme={appearance.boardTheme}
        pieceSet={appearance.pieceSet}
      />
    );
  }

  const piecesToPlace = current ? countPieces(real) : 0;
  const placed = countPieces(placement);

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={board}
      panel={
        <>
          {(phase === 'setup' || phase === 'loading') && (
            <div className={CARD_CLASS}>
              <ModeTabs mode={mode} onChange={onModeChange} />
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Rebuild the position</h2>
                <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
                  Memorize the position. Then the board is emptied and you put every piece back where it was.
                  A round is {RECONSTRUCT_ROUND} positions.
                </p>
              </div>

              <DrillPicker kind={kind} onChange={onKindChange} />

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Pieces on the board</span>
                <div className="grid grid-cols-4 gap-1 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
                  {RECONSTRUCT_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      data-testid={`rebuild-level-${level}`}
                      aria-pressed={settings.level === level}
                      aria-label={levelDescription(level)}
                      disabled={phase === 'loading'}
                      onClick={() => setSettings({ ...settings, level })}
                      className={segmentClass(settings.level === level)}
                    >
                      ≤ {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-semibold text-white">Memorize time</span>
                <div className="grid grid-cols-3 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
                  {RECONSTRUCT_SECONDS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      data-testid={`rebuild-seconds-${seconds}`}
                      aria-pressed={settings.seconds === seconds}
                      disabled={phase === 'loading'}
                      onClick={() => setSettings({ ...settings, seconds })}
                      className={segmentClass(settings.seconds === seconds)}
                    >
                      {seconds} s
                    </button>
                  ))}
                </div>
              </div>

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
                  ? `Your best (${levelDescription(settings.level)}): ${best}/${RECONSTRUCT_ROUND} perfect`
                  : 'No record yet for this level.'}
              </p>

              <button
                type="button"
                onClick={() => void startRound()}
                disabled={phase === 'loading'}
                className={PRIMARY_BUTTON_CLASS}
              >
                {phase === 'loading' ? 'Loading positions…' : 'Start'}
              </button>
            </div>
          )}

          {running && current && (
            <div className={CARD_CLASS}>
              <div className="grid grid-cols-3 gap-2.5">
                <StatTile label="Position" value={`${index + 1}/${items.length}`} />
                <StatTile label="Perfect" value={String(perfect)} tone="good" />
                <StatTile label="Pieces" value={String(piecesToPlace)} />
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
                        style={{ width: `${Math.max(0, Math.min(100, (msLeft / (settings.seconds * 1000)) * 100))}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-white/80" data-testid="status">
                    {piecesToPlace} pieces. Remember where each one stands.
                  </p>
                  <button type="button" onClick={hidePieces} className={SECONDARY_BUTTON_CLASS}>
                    I’m ready, empty the board
                  </button>
                </div>
              )}

              {phase === 'build' && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-white/80" data-testid="status">
                    Put the {piecesToPlace} pieces back. Placed: {placed}.
                  </p>
                  <div className="flex flex-col gap-1.5" role="group" aria-label="Pieces">
                    {[WHITE_PIECES, BLACK_PIECES].map((row) => (
                      <div key={row[0]} className="grid grid-cols-6 gap-1">
                        {row.map((code) => (
                          <button
                            key={code}
                            type="button"
                            data-testid={`tool-${code}`}
                            aria-label={pieceLabel(code)}
                            aria-pressed={tool === code}
                            title={pieceLabel(code)}
                            onMouseDown={(e) => startDragFromPalette(code, e)}
                            onTouchStart={(e) => startDragFromPalette(code, e)}
                            onClick={() => setTool(code)}
                            style={{ touchAction: 'none' }}
                            className={`h-10 rounded-xl border transition-colors duration-150 cursor-grab flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                              tool === code
                                ? 'bg-[#39ff88]/20 border-[#39ff88]'
                                : 'bg-[#101b2f] border-white/15 hover:border-white/60'
                            }`}
                          >
                            <img
                              src={`/pieces/${appearance.pieceSet}/${code}.svg`}
                              alt=""
                              draggable={false}
                              className="h-[88%] aspect-square select-none pointer-events-none"
                            />
                          </button>
                        ))}
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        data-testid="tool-pointer"
                        aria-pressed={tool === 'pointer'}
                        onClick={() => setTool('pointer')}
                        className={`${segmentClass(tool === 'pointer')} !min-h-[36px] !py-1.5 flex items-center justify-center gap-2 border border-white/10`}
                      >
                        <Hand className="w-4 h-4" aria-hidden="true" /> Move pieces
                      </button>
                      <button
                        type="button"
                        data-testid="tool-trash"
                        aria-pressed={tool === 'trash'}
                        onClick={() => setTool('trash')}
                        className={`${segmentClass(tool === 'trash')} !min-h-[36px] !py-1.5 flex items-center justify-center gap-2 border border-white/10`}
                      >
                        <Eraser className="w-4 h-4" aria-hidden="true" /> Delete pieces
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-white/65 leading-snug">
                    Drag a piece onto the board, or pick one and tap squares. Tap the same piece again to take it
                    off.
                  </p>
                  <button type="button" onClick={check} data-testid="rebuild-check" className={PRIMARY_BUTTON_CLASS}>
                    Check
                  </button>
                  <button
                    type="button"
                    data-testid="rebuild-clear"
                    onClick={() => setPlacement(EMPTY_PLACEMENT)}
                    className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" /> Clear the board
                  </button>
                </div>
              )}

              {phase === 'feedback' && outcome && (
                <div className="flex flex-col gap-3">
                  <p
                    className={`text-lg font-bold ${outcome.comparison.perfect ? 'text-[#39ff88]' : 'text-[#ff7a7a]'}`}
                    data-testid="status"
                  >
                    {outcome.comparison.perfect
                      ? 'Perfect!'
                      : `${outcome.comparison.correct} of ${outcome.comparison.total} pieces right.`}
                  </p>
                  {outcome.comparison.missed.length > 0 && (
                    <p className="text-sm font-semibold text-white/85" data-testid="missed">
                      Missing or misplaced:{' '}
                      <span className="font-bold text-white">{shortNames(outcome.comparison.missed)}</span>
                    </p>
                  )}
                  {outcome.comparison.extra.length > 0 && (
                    <p className="text-sm font-semibold text-white/85" data-testid="extra">
                      Not in the position:{' '}
                      <span className="font-bold text-white">{shortNames(outcome.comparison.extra)}</span>
                    </p>
                  )}
                  <p className="text-xs font-medium text-white/60">The board shows the real position.</p>
                  <button type="button" onClick={next} autoFocus className={PRIMARY_BUTTON_CLASS}>
                    {index + 1 >= items.length ? 'See result' : 'Next position'}
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
                  {result.perfect}/{items.length}
                </div>
                <div className="text-sm font-semibold text-white/70 mt-2">
                  positions rebuilt perfectly ({levelDescription(settings.level)})
                </div>
                {result.isNewBest && (
                  <div className="inline-block mt-3 px-3 py-1 rounded-full bg-[#39ff88]/15 border border-[#39ff88] text-[#39ff88] text-xs font-bold">
                    New best!
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <StatTile
                  label="Pieces right"
                  value={`${result.piecesRight}/${result.piecesTotal}`}
                />
                <StatTile label="Best" value={`${result.best}/${RECONSTRUCT_ROUND}`} tone="good" />
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
