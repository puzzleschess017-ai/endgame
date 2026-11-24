import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { Key } from 'chessground/types';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  FlipVertical2,
  PencilLine,
  RotateCcw,
} from 'lucide-react';
import ChessboardPanel, { type PendingPromotion } from '../components/ChessboardPanel';
import { COMPACT_CARD_CLASS, SECONDARY_BUTTON_CLASS } from '../components/panelUi';
import TrainerLayout from '../components/TrainerLayout';
import { useAppearance } from '../hooks/useAppearance';
import {
  back,
  createAnalysis,
  currentFen,
  exportPgn,
  forward,
  goTo,
  lastMoveAt,
  moveRows,
  parsePgn,
  playMove,
  statusAt,
  toEnd,
  toStart,
  type Analysis,
} from '../utils/analysis';
import { copyText } from '../utils/clipboard';
import { getLegalDests, isPromotionMove } from '../utils/chessHelpers';
import { buildFen, parseFen, validateFen } from '../utils/editor';
import { readSavedUsername } from '../utils/profile';
import { playMoveSound } from '../utils/sound';
import {
  EXAMPLES,
  fetchTablebase,
  lookupProblem,
  moveLabel,
  verdictText,
  type Tone,
  type TablebaseResult,
} from '../utils/tablebase';

const NAV_BUTTON_CLASS =
  'py-1.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-[#39ff88] hover:text-[#39ff88] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/20 disabled:hover:text-white text-white flex items-center justify-center cursor-pointer min-h-[36px] focus-visible:outline-2 focus-visible:outline-[#39ff88]';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-[#39ff88]',
  neutral: 'text-amber-300',
  bad: 'text-[#ff7a7a]',
};

/** Reads a FEN typed or pasted by the person. Missing fields are filled in; illegal positions are refused with a reason. */
function readFen(text: string): { ok: true; fen: string } | { ok: false; error: string } {
  const parsed = parseFen(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const fen = buildFen(parsed.position);
  const validation = validateFen(fen);
  return validation.ok ? { ok: true, fen } : { ok: false, error: validation.reason };
}

/** The position the page opens with: the one in the address (?fen=) when it is legal, else the first example. */
function initialAnalysis(): Analysis {
  const fen = new URLSearchParams(window.location.search).get('fen');
  if (fen) {
    const read = readFen(fen);
    if (read.ok) return createAnalysis(read.fen);
  }
  return createAnalysis(EXAMPLES[0].fen);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

type Lookup =
  | { state: 'unavailable'; message: string }
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; result: TablebaseResult };

export default function TablebasePage() {
  const [appearance, setAppearance] = useAppearance();
  const [username] = useState(() => readSavedUsername());

  const [analysis, setAnalysis] = useState<Analysis>(initialAnalysis);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [syncToken, setSyncToken] = useState(0);
  const [hoverUci, setHoverUci] = useState<string | null>(null);
  const [fenDraft, setFenDraft] = useState<string | null>(null);
  const [fenError, setFenError] = useState<string | null>(null);
  const [pgnDraft, setPgnDraft] = useState('');
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'fen' | 'pgn' | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: 'loading' });
  const [retry, setRetry] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const answers = useRef(new Map<string, TablebaseResult>());

  useEffect(() => {
    document.title = 'Endgame Tablebase | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Endgame tablebase: perfect play for any chess position with 7 pieces or fewer. See who wins and the best move.',
      );
  }, []);

  const fen = currentFen(analysis);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const dests = useMemo(() => getLegalDests(chess), [chess]);
  const turn = chess.turn();
  const turnColor = turn === 'w' ? 'white' : 'black';
  const lastMove = lastMoveAt(analysis);
  const status = statusAt(analysis);
  const rows = useMemo(() => moveRows(analysis), [analysis]);

  const atStart = analysis.index === 0;
  const atEnd = analysis.index === analysis.moves.length;

  // Ask the tablebase whenever the position changes (answers already seen are kept for the visit).
  useEffect(() => {
    setHoverUci(null);
    const problem = lookupProblem(fen);
    if (problem) {
      setLookup({ state: 'unavailable', message: problem });
      return;
    }
    const known = answers.current.get(fen);
    if (known) {
      setLookup({ state: 'ready', result: known });
      return;
    }
    setLookup({ state: 'loading' });
    const controller = new AbortController();
    fetchTablebase(fen, controller.signal)
      .then((answer) => {
        if (answer.ok) {
          answers.current.set(fen, answer.result);
          setLookup({ state: 'ready', result: answer.result });
        } else {
          setLookup({ state: 'error', message: answer.error });
        }
      })
      .catch(() => {
        // Aborted: the position changed before the answer came.
      });
    return () => controller.abort();
  }, [fen, retry]);

  const sync = () => setSyncToken((t) => t + 1);

  const soundFor = (move: { capture: boolean; check: boolean }) =>
    playMoveSound(move.check ? 'check' : move.capture ? 'capture' : 'move');

  const makeMove = (from: Key, to: Key, promotion?: 'q' | 'r' | 'b' | 'n') => {
    const result = playMove(analysis, from, to, promotion);
    setPending(null);
    if (!result) {
      sync();
      return;
    }
    setAnalysis(result.analysis);
    soundFor(result.move);
  };

  const handleUserMove = (from: Key, to: Key) => {
    if (isPromotionMove(chess, from as Square, to as Square)) {
      setPending({ from, to, color: turnColor });
      return;
    }
    makeMove(from, to);
  };

  /** Plays a move of the tablebase list ("e7e8q"). */
  const playUci = (uci: string) => {
    const promotion = uci.length > 4 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
    makeMove(uci.slice(0, 2) as Key, uci.slice(2, 4) as Key, promotion);
  };

  const navigate = useCallback((next: (a: Analysis) => Analysis) => {
    setPending(null);
    setAnalysis((a) => next(a));
    setSyncToken((t) => t + 1);
  }, []);

  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  const stepForward = useCallback(() => {
    const next = forward(analysisRef.current);
    if (next === analysisRef.current) return;
    setPending(null);
    setAnalysis(next);
    setSyncToken((t) => t + 1);
    const move = next.moves[next.index - 1];
    playMoveSound(move.check ? 'check' : move.capture ? 'capture' : 'move');
  }, []);

  // Arrow keys step through the game, Home and End jump to the ends.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'ArrowLeft') navigate(back);
      else if (event.key === 'ArrowRight') stepForward();
      else if (event.key === 'Home') navigate(toStart);
      else if (event.key === 'End') navigate(toEnd);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, stepForward]);

  // Keep the move that is shown inside the visible part of the move list (without moving the page).
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[data-current="true"]');
    if (!list || !active) {
      if (list) list.scrollTop = 0;
      return;
    }
    // The list is the positioned parent of the move buttons, so offsetTop is already measured inside it.
    const top = active.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (top + active.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + active.offsetHeight - list.clientHeight + 8;
    }
  }, [analysis.index, analysis.moves.length, analysis.startFen]);

  const flash = (what: 'fen' | 'pgn') => {
    setCopied(what);
    window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600);
  };

  const startFrom = (newFen: string) => {
    setPending(null);
    setAnalysis(createAnalysis(newFen));
    setFenDraft(null);
    setFenError(null);
    sync();
  };

  const loadFen = () => {
    const read = readFen(fenDraft ?? fen);
    if (!read.ok) {
      setFenError(read.error);
      return;
    }
    startFrom(read.fen);
  };

  const importPgn = () => {
    const result = parsePgn(pgnDraft);
    if (!result.ok) {
      setPgnError(result.error);
      return;
    }
    setPending(null);
    setAnalysis({ startFen: result.startFen, moves: result.moves, index: 0 });
    setPgnError(null);
    setPgnDraft('');
    setFenDraft(null);
    setFenError(null);
    sync();
  };

  const moveButton = (san: string, index: number) => {
    const current = analysis.index === index;
    return (
      <button
        type="button"
        data-testid={`move-${index}`}
        data-current={current}
        aria-current={current ? 'step' : undefined}
        onClick={() => navigate((a) => goTo(a, index))}
        className={`flex-1 text-left px-2.5 py-1.5 rounded-lg text-sm font-bold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
          current ? 'bg-[#39ff88] text-[#101b2f]' : 'text-white hover:bg-white/10'
        }`}
      >
        {san}
      </button>
    );
  };

  const verdict = lookup.state === 'ready' ? verdictText(lookup.result, turn) : null;
  const hintArrow: [Key, Key] | null = hoverUci ? [hoverUci.slice(0, 2) as Key, hoverUci.slice(2, 4) as Key] : null;
  const editorHref = `/editor?fen=${encodeURIComponent(fen)}`;

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={
        <ChessboardPanel
          fen={fen}
          orientation={orientation}
          turnColor={turnColor}
          dests={dests}
          lastMove={lastMove ? [lastMove.from as Key, lastMove.to as Key] : undefined}
          check={chess.inCheck() ? turnColor : false}
          hintArrow={hintArrow}
          viewOnly={false}
          syncToken={syncToken}
          boardTheme={appearance.boardTheme}
          pieceSet={appearance.pieceSet}
          onUserMove={handleUserMove}
          pendingPromotion={pending}
          onSelectPromotion={(piece) => pending && makeMove(pending.from, pending.to, piece)}
          onCancelPromotion={() => {
            setPending(null);
            sync();
          }}
        />
      }
      panel={
        <div className={COMPACT_CARD_CLASS} data-testid="tablebase-panel">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Endgame Tablebase</h2>
            <p className="mt-0.5 text-xs font-medium text-white/70">
              Perfect play for positions with 7 pieces or fewer. Play on the board.
            </p>
          </div>

          <div className="flex flex-col gap-1" data-testid="tb-verdict" aria-live="polite">
            <p data-testid="analysis-status" className="text-xs font-semibold text-white/70">
              {status.text}
            </p>
            {lookup.state === 'loading' && <p className="text-base font-bold text-white/80">Looking it up…</p>}
            {lookup.state === 'unavailable' && (
              <div className="flex flex-col gap-2">
                <p data-testid="tb-unavailable" className="text-sm font-semibold text-amber-300 leading-relaxed">
                  {lookup.message}
                </p>
                <a href={editorHref} className="text-sm font-bold text-[#39ff88] underline underline-offset-2 w-fit">
                  Open this position in the Board Editor
                </a>
              </div>
            )}
            {lookup.state === 'error' && (
              <div className="flex flex-col gap-2">
                <p role="alert" data-testid="tb-error" className="text-sm font-semibold text-[#ff7a7a] leading-relaxed">
                  {lookup.message}
                </p>
                <button type="button" data-testid="tb-retry" onClick={() => setRetry((r) => r + 1)} className={`${SECONDARY_BUTTON_CLASS} !w-auto self-start`}>
                  Try again
                </button>
              </div>
            )}
            {verdict && (
              <div>
                <p data-testid="tb-headline" data-tone={verdict.tone} className={`text-lg font-bold tracking-tight ${TONE_TEXT[verdict.tone]}`}>
                  {verdict.headline}
                </p>
                {verdict.detail && (
                  <p data-testid="tb-detail" className="text-sm font-medium text-white/75 leading-snug">
                    {verdict.detail}
                  </p>
                )}
              </div>
            )}
          </div>

          {lookup.state === 'ready' && lookup.result.moves.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-bold text-white/80">Moves, best first</h3>
              <ul data-testid="tb-moves" className="max-h-[132px] overflow-y-auto rounded-xl bg-[#101b2f] border border-white/10 p-1 flex flex-col gap-0.5">
                {lookup.result.moves.map((move) => {
                  const label = moveLabel(move);
                  return (
                    <li key={move.uci}>
                      <button
                        type="button"
                        data-testid={`tb-move-${move.uci}`}
                        data-tone={label.tone}
                        onClick={() => playUci(move.uci)}
                        onMouseEnter={() => setHoverUci(move.uci)}
                        onMouseLeave={() => setHoverUci(null)}
                        onFocus={() => setHoverUci(move.uci)}
                        onBlur={() => setHoverUci(null)}
                        className="w-full flex items-center justify-between gap-3 px-2.5 py-1 rounded-lg text-sm cursor-pointer hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#39ff88]"
                      >
                        <span className="font-bold text-white">{move.san}</span>
                        <span className={`font-semibold ${TONE_TEXT[label.tone]}`}>{label.text}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Move navigation">
            <button type="button" data-testid="nav-start" onClick={() => navigate(toStart)} disabled={atStart} className={NAV_BUTTON_CLASS} aria-label="First position" title="First position (Home)">
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button type="button" data-testid="nav-back" onClick={() => navigate(back)} disabled={atStart} className={NAV_BUTTON_CLASS} aria-label="Previous move" title="Previous move (Left arrow)">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" data-testid="nav-forward" onClick={stepForward} disabled={atEnd} className={NAV_BUTTON_CLASS} aria-label="Next move" title="Next move (Right arrow)">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button type="button" data-testid="nav-end" onClick={() => navigate(toEnd)} disabled={atEnd} className={NAV_BUTTON_CLASS} aria-label="Last position" title="Last position (End)">
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={listRef}
            data-testid="move-list"
            className="relative max-h-[84px] min-h-[44px] overflow-y-auto rounded-xl bg-[#101b2f] border border-white/10 p-1.5"
          >
            {rows.length === 0 ? (
              <p className="px-2 py-1 text-sm font-medium text-white/60">Moves you play appear here.</p>
            ) : (
              <ol className="flex flex-col gap-0.5">
                {rows.map((row) => (
                  <li key={row.number} className="flex items-center gap-1">
                    <span className="w-9 shrink-0 text-right pr-1.5 text-xs font-semibold text-white/55 tabular-nums">{row.number}.</span>
                    {row.white ? moveButton(row.white.san, row.white.index) : <span className="flex-1 px-2.5 text-sm font-bold text-white/40">…</span>}
                    {row.black ? moveButton(row.black.san, row.black.index) : <span className="flex-1" />}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              data-testid="btn-flip"
              onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-1.5 !px-2 !min-h-[36px] !py-1.5`}
            >
              <FlipVertical2 className="w-4 h-4" aria-hidden="true" /> Flip
            </button>
            <button type="button" data-testid="btn-reset" onClick={() => startFrom(analysis.startFen)} className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-1.5 !px-2 !min-h-[36px] !py-1.5`}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Reset
            </button>
            <a
              href={editorHref}
              data-testid="btn-edit"
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-1.5 !px-2 no-underline`}
            >
              <PencilLine className="w-4 h-4" aria-hidden="true" /> Edit
            </a>
          </div>

          <details className="group" data-testid="share-details">
            <summary className="cursor-pointer text-sm font-bold text-white select-none focus-visible:outline-2 focus-visible:outline-[#39ff88] rounded">
              Examples, FEN and PGN
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-white">Try a position</h3>
            <div className="flex flex-wrap gap-2" data-testid="examples">
              {EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  data-testid={`example-${example.id}`}
                  onClick={() => startFrom(example.fen)}
                  className="px-3 py-2 rounded-lg bg-[#101b2f] border border-white/20 hover:border-[#39ff88] text-xs font-semibold text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-[#39ff88]"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="tb-fen" className="text-sm font-bold text-white">
                  Position (FEN)
                </label>
                <div className="flex gap-2">
                  <input
                    id="tb-fen"
                    data-testid="fen-input"
                    value={fenDraft ?? fen}
                    onChange={(e) => {
                      setFenDraft(e.target.value);
                      setFenError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadFen();
                    }}
                    spellCheck={false}
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-[#101b2f] border border-white/20 rounded-lg px-3 py-2 text-xs font-mono text-white min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88]"
                  />
                  <button type="button" data-testid="fen-load" onClick={loadFen} className={`${SECONDARY_BUTTON_CLASS} !w-auto`}>
                    Load
                  </button>
                  <button
                    type="button"
                    data-testid="fen-copy"
                    aria-label="Copy FEN"
                    title="Copy FEN"
                    onClick={async () => {
                      if (await copyText(fen)) flash('fen');
                    }}
                    className={`${SECONDARY_BUTTON_CLASS} !w-auto !px-3`}
                  >
                    {copied === 'fen' ? <Check className="w-4 h-4 text-[#39ff88]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {fenError && (
                  <p role="alert" data-testid="fen-error" className="text-sm font-semibold text-[#ff7a7a]">
                    {fenError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="tb-pgn" className="text-sm font-bold text-white">
                  Game (PGN)
                </label>
                <textarea
                  id="tb-pgn"
                  data-testid="pgn-input"
                  value={pgnDraft}
                  onChange={(e) => {
                    setPgnDraft(e.target.value);
                    setPgnError(null);
                  }}
                  rows={4}
                  placeholder="Paste a game here, for example 1. e4 e5 2. Nf3 Nc6"
                  spellCheck={false}
                  className="bg-[#101b2f] border border-white/20 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-white/40 resize-y focus-visible:outline-2 focus-visible:outline-[#39ff88]"
                />
                {pgnError && (
                  <p role="alert" data-testid="pgn-error" className="text-sm font-semibold text-[#ff7a7a]">
                    {pgnError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" data-testid="pgn-import" onClick={importPgn} disabled={!pgnDraft.trim()} className={SECONDARY_BUTTON_CLASS}>
                    Import PGN
                  </button>
                  <button
                    type="button"
                    data-testid="pgn-copy"
                    disabled={analysis.moves.length === 0}
                    onClick={async () => {
                      if (await copyText(exportPgn(analysis))) flash('pgn');
                    }}
                    className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
                  >
                    {copied === 'pgn' ? <Check className="w-4 h-4 text-[#39ff88]" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                    {copied === 'pgn' ? 'Copied' : 'Copy PGN'}
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>
      }
    />
  );
}
