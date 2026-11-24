import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import type { Key } from 'chessground/types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, Copy, FlipVertical2, PencilLine, RotateCcw } from 'lucide-react';
import ChessboardPanel, { type PendingPromotion } from '../components/ChessboardPanel';
import { CARD_CLASS, SECONDARY_BUTTON_CLASS } from '../components/panelUi';
import TrainerLayout from '../components/TrainerLayout';
import { useAppearance } from '../hooks/useAppearance';
import {
  back,
  createAnalysis,
  currentFen,
  exportPgn,
  forward,
  lastMoveAt,
  moveRows,
  parsePgn,
  playMove,
  statusAt,
  toEnd,
  toStart,
  goTo,
  type Analysis,
} from '../utils/analysis';
import { copyText } from '../utils/clipboard';
import { getLegalDests, isPromotionMove } from '../utils/chessHelpers';
import { buildFen, parseFen, validateFen } from '../utils/editor';
import { readSavedUsername } from '../utils/profile';
import { playMoveSound } from '../utils/sound';

const NAV_BUTTON_CLASS =
  'py-2.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-[#39ff88] hover:text-[#39ff88] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-white/20 disabled:hover:text-white text-white flex items-center justify-center cursor-pointer min-h-[44px] focus-visible:outline-2 focus-visible:outline-[#39ff88]';

/** Reads a FEN typed or pasted by the person. Missing fields are filled in; illegal positions are refused with a reason. */
function readFen(text: string): { ok: true; fen: string } | { ok: false; error: string } {
  const parsed = parseFen(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const fen = buildFen(parsed.position);
  const validation = validateFen(fen);
  return validation.ok ? { ok: true, fen } : { ok: false, error: validation.reason };
}

/** The position the board opens with: the one in the address (?fen=) when it is a legal position, else the start. */
function initialAnalysis(): Analysis {
  const fen = new URLSearchParams(window.location.search).get('fen');
  if (fen) {
    const read = readFen(fen);
    if (read.ok) return createAnalysis(read.fen);
  }
  return createAnalysis();
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export default function AnalysisPage() {
  const [appearance, setAppearance] = useAppearance();
  const [username] = useState(() => readSavedUsername());

  const [analysis, setAnalysis] = useState<Analysis>(initialAnalysis);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [pending, setPending] = useState<PendingPromotion | null>(null);
  const [syncToken, setSyncToken] = useState(0);
  const [fenDraft, setFenDraft] = useState<string | null>(null);
  const [fenError, setFenError] = useState<string | null>(null);
  const [pgnDraft, setPgnDraft] = useState('');
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'fen' | 'pgn' | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = 'Analysis Board | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Free chess analysis board: play moves for both sides, step through a game, and load any position (FEN) or game (PGN).',
      );
  }, []);

  const fen = currentFen(analysis);
  const chess = useMemo(() => new Chess(fen), [fen]);
  const dests = useMemo(() => getLegalDests(chess), [chess]);
  const turnColor = chess.turn() === 'w' ? 'white' : 'black';
  const lastMove = lastMoveAt(analysis);
  const status = statusAt(analysis);
  const rows = useMemo(() => moveRows(analysis), [analysis]);

  const atStart = analysis.index === 0;
  const atEnd = analysis.index === analysis.moves.length;

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

  const loadFen = () => {
    const read = readFen(fenDraft ?? fen);
    if (!read.ok) {
      setFenError(read.error);
      return;
    }
    setPending(null);
    setAnalysis(createAnalysis(read.fen));
    setFenDraft(null);
    setFenError(null);
    sync();
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

  const reset = () => {
    setPending(null);
    setAnalysis(createAnalysis());
    setFenDraft(null);
    setFenError(null);
    setPgnError(null);
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
          hintArrow={null}
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
        <div className={CARD_CLASS} data-testid="analysis-panel">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Analysis Board</h2>
            <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
              Play moves for both sides, step through a game and load any position or PGN. There is no computer
              engine here.
            </p>
          </div>

          <p
            data-testid="analysis-status"
            className={`text-base font-bold ${status.over ? 'text-amber-300' : 'text-[#39ff88]'}`}
            aria-live="polite"
          >
            {status.text}
          </p>

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
            className="relative max-h-[260px] min-h-[96px] overflow-y-auto rounded-xl bg-[#101b2f] border border-white/10 p-2"
          >
            {rows.length === 0 ? (
              <p className="px-2 py-3 text-sm font-medium text-white/60">Make a move on the board to start the list.</p>
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
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-1.5 !px-2`}
            >
              <FlipVertical2 className="w-4 h-4" aria-hidden="true" /> Flip
            </button>
            <button type="button" data-testid="btn-reset" onClick={reset} className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-1.5 !px-2`}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Reset
            </button>
            <a
              href={`/editor?fen=${encodeURIComponent(fen)}`}
              data-testid="btn-edit"
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-1.5 !px-2 no-underline`}
            >
              <PencilLine className="w-4 h-4" aria-hidden="true" /> Edit
            </a>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="analysis-fen" className="text-sm font-bold text-white">
              Position (FEN)
            </label>
            <div className="flex gap-2">
              <input
                id="analysis-fen"
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
            <label htmlFor="analysis-pgn" className="text-sm font-bold text-white">
              Game (PGN)
            </label>
            <textarea
              id="analysis-pgn"
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
      }
    />
  );
}
