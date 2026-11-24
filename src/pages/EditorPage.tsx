import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Check, Copy, Database, Eraser, FlipVertical2, Hand, Trash2 } from 'lucide-react';
import ChessboardPanel from '../components/ChessboardPanel';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, segmentClass } from '../components/panelUi';
import TrainerLayout from '../components/TrainerLayout';
import { useAppearance } from '../hooks/useAppearance';
import {
  buildFen,
  emptyPosition,
  enPassantSquare,
  parseFen,
  possibleCastling,
  startPosition,
  validateFen,
  type Castling,
  type EditorPosition,
} from '../utils/editor';
import { readSavedUsername } from '../utils/profile';
import { copyText } from '../utils/clipboard';
import { lookupProblem } from '../utils/tablebase';

type PieceCode = 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP' | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP';
type Tool = 'pointer' | 'trash' | PieceCode;

const ROLES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' } as const;
const WHITE_PIECES: PieceCode[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'];
const BLACK_PIECES: PieceCode[] = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const PIECE_NAMES: Record<string, string> = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

const NO_DESTS = new Map<Key, Key[]>();
const noop = () => {};

function pieceOfCode(code: PieceCode) {
  return { color: code[0] === 'w' ? ('white' as const) : ('black' as const), role: ROLES[code[1] as keyof typeof ROLES] };
}

function pieceLabel(code: PieceCode): string {
  return `${code[0] === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[code[1]]}`;
}

const CASTLING_OPTIONS: Array<{ key: keyof Castling; label: string }> = [
  { key: 'K', label: 'White O-O' },
  { key: 'Q', label: 'White O-O-O' },
  { key: 'k', label: 'Black O-O' },
  { key: 'q', label: 'Black O-O-O' },
];

/** The position the editor opens with: the one in the address (?fen=) when it is a real FEN, else the start. */
function initialPosition(): EditorPosition {
  const fen = new URLSearchParams(window.location.search).get('fen');
  if (fen) {
    const parsed = parseFen(fen);
    if (parsed.ok) return parsed.position;
  }
  return startPosition();
}

export default function EditorPage() {
  const [appearance, setAppearance] = useAppearance();
  const [username] = useState(() => readSavedUsername());

  const [position, setPosition] = useState<EditorPosition>(initialPosition);
  const [tool, setTool] = useState<Tool>('pointer');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [fenDraft, setFenDraft] = useState<string | null>(null);
  const [fenError, setFenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const apiRef = useRef<Api | null>(null);
  const toolRef = useRef<Tool>('pointer');
  toolRef.current = tool;

  useEffect(() => {
    document.title = 'Board Editor | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Free chess board editor: set up any position, then copy the FEN or check it in the endgame tablebase.',
      );
  }, []);

  const fen = useMemo(() => buildFen(position), [position]);
  const validation = useMemo(() => validateFen(fen), [fen]);
  const castling = useMemo(() => possibleCastling(position.placement, position.castling), [position]);

  const update = (patch: Partial<EditorPosition>) => {
    setPosition((p) => ({ ...p, ...patch }));
    setFenDraft(null);
    setFenError(null);
  };

  /** The board changed (a piece was moved, dragged in or dragged off). */
  const handleBoardChange = (placement: string) => {
    setPosition((p) => (p.placement === placement ? p : { ...p, placement }));
    setFenDraft(null);
    setFenError(null);
  };

  /** A square was pressed: put the piece of the chosen tool there (the same piece again takes it off). */
  const handleSquare = (key: Key) => {
    const api = apiRef.current;
    const current = toolRef.current;
    if (!api || current === 'pointer') return;
    const here = api.state.pieces.get(key);
    if (current === 'trash') {
      if (!here) return;
      api.setPieces(new Map([[key, undefined]]));
    } else {
      const piece = pieceOfCode(current);
      const same = here && here.color === piece.color && here.role === piece.role;
      api.setPieces(new Map([[key, same ? undefined : piece]]));
    }
    handleBoardChange(api.getFen());
  };

  /** Picks up a piece from the palette: it is chosen as the tool and can be dragged straight onto the board. */
  const startDragFromPalette = (code: PieceCode, event: ReactMouseEvent | ReactTouchEvent) => {
    setTool(code);
    apiRef.current?.dragNewPiece(pieceOfCode(code), event.nativeEvent as MouseEvent, true);
  };

  const loadFen = () => {
    const text = (fenDraft ?? fen).trim();
    const parsed = parseFen(text);
    if (!parsed.ok) {
      setFenError(parsed.error);
      return;
    }
    setPosition(parsed.position);
    setFenDraft(null);
    setFenError(null);
  };

  const copyFen = async () => {
    if (await copyText(fen)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const effectiveEp = enPassantSquare(position.placement, position.turn, position.ep) === '-' ? '' : position.ep ?? '';
  const tablebaseHref = `/tablebase?fen=${encodeURIComponent(fen)}`;
  const tablebaseProblem = validation.ok ? lookupProblem(fen) : null;

  return (
    <TrainerLayout
      username={username}
      appearance={appearance}
      onAppearanceChange={setAppearance}
      board={
        <ChessboardPanel
          fen={fen}
          orientation={orientation}
          turnColor={position.turn === 'w' ? 'white' : 'black'}
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
          edit={{
            onChange: handleBoardChange,
            apiRef,
            onSquare: handleSquare,
            dragEnabled: tool === 'pointer',
          }}
        />
      }
      panel={
        <div className={CARD_CLASS} data-testid="editor-panel">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Board Editor</h2>
            <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
              Set up any position. Drag a piece onto the board, or pick one and tap squares. Drag a piece off the
              board to remove it.
            </p>
          </div>

          <div className="flex flex-col gap-2" role="group" aria-label="Pieces">
            {[WHITE_PIECES, BLACK_PIECES].map((row) => (
              <div key={row[0]} className="grid grid-cols-6 gap-1.5">
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
                    className={`aspect-square rounded-xl border transition-colors duration-150 cursor-grab flex items-center justify-center focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                      tool === code
                        ? 'bg-[#39ff88]/20 border-[#39ff88]'
                        : 'bg-[#101b2f] border-white/15 hover:border-white/60'
                    }`}
                  >
                    <img
                      src={`/pieces/${appearance.pieceSet}/${code}.svg`}
                      alt=""
                      draggable={false}
                      className="w-[88%] h-[88%] select-none pointer-events-none"
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
                className={`${segmentClass(tool === 'pointer')} flex items-center justify-center gap-2 border border-white/10`}
              >
                <Hand className="w-4 h-4" aria-hidden="true" /> Move pieces
              </button>
              <button
                type="button"
                data-testid="tool-trash"
                aria-pressed={tool === 'trash'}
                onClick={() => setTool('trash')}
                className={`${segmentClass(tool === 'trash')} flex items-center justify-center gap-2 border border-white/10`}
              >
                <Eraser className="w-4 h-4" aria-hidden="true" /> Delete pieces
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-white">Side to move</h3>
            <div className="grid grid-cols-2 gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10" role="group" aria-label="Side to move">
              <button type="button" data-testid="turn-w" aria-pressed={position.turn === 'w'} onClick={() => update({ turn: 'w' })} className={segmentClass(position.turn === 'w')}>
                White
              </button>
              <button type="button" data-testid="turn-b" aria-pressed={position.turn === 'b'} onClick={() => update({ turn: 'b' })} className={segmentClass(position.turn === 'b')}>
                Black
              </button>
            </div>

            <h3 className="text-sm font-bold text-white mt-1">Castling</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {CASTLING_OPTIONS.map(({ key, label }) => {
                const possible = possibleCastling(position.placement, { K: true, Q: true, k: true, q: true })[key];
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-2 text-sm font-semibold ${possible ? 'text-white cursor-pointer' : 'text-white/40 cursor-not-allowed'}`}
                  >
                    <input
                      type="checkbox"
                      data-testid={`castling-${key}`}
                      checked={castling[key]}
                      disabled={!possible}
                      onChange={(e) => update({ castling: { ...position.castling, [key]: e.target.checked } })}
                      className="w-4 h-4 accent-[#39ff88]"
                    />
                    {label}
                  </label>
                );
              })}
            </div>

            <label className="flex items-center justify-between gap-3 text-sm font-bold text-white mt-1">
              En passant
              <select
                data-testid="ep-select"
                value={effectiveEp}
                onChange={(e) => update({ ep: e.target.value || null })}
                className="bg-[#101b2f] border border-white/20 rounded-lg px-2.5 py-2 text-sm font-semibold text-white min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88]"
              >
                <option value="">None</option>
                {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((file) => (
                  <option key={file} value={file} disabled={enPassantSquare(position.placement, position.turn, file) === '-'}>
                    {file}-file
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="editor-fen" className="text-sm font-bold text-white">
              FEN
            </label>
            <div className="flex gap-2">
              <input
                id="editor-fen"
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
            </div>
            {fenError ? (
              <p role="alert" data-testid="fen-error" className="text-sm font-semibold text-[#ff7a7a]">
                {fenError}
              </p>
            ) : validation.ok ? (
              <p data-testid="fen-status" className="text-sm font-semibold text-[#39ff88]">
                This position is valid.
              </p>
            ) : (
              <p data-testid="fen-status" className="text-sm font-semibold text-amber-300">
                {validation.reason}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="btn-start"
              onClick={() => update(startPosition())}
              className={SECONDARY_BUTTON_CLASS}
            >
              Start position
            </button>
            <button
              type="button"
              data-testid="btn-clear"
              onClick={() => update(emptyPosition())}
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" /> Clear board
            </button>
            <button
              type="button"
              data-testid="btn-flip"
              onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
            >
              <FlipVertical2 className="w-4 h-4" aria-hidden="true" /> Flip board
            </button>
            <button
              type="button"
              data-testid="btn-copy"
              onClick={copyFen}
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
            >
              {copied ? <Check className="w-4 h-4 text-[#39ff88]" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy FEN'}
            </button>
          </div>

          {validation.ok ? (
            <a
              href={tablebaseHref}
              data-testid="btn-analyze"
              className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center gap-2 no-underline`}
            >
              <Database className="w-5 h-5" aria-hidden="true" /> Check in the Tablebase
            </a>
          ) : (
            <button type="button" data-testid="btn-analyze" disabled className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center gap-2`}>
              <Database className="w-5 h-5" aria-hidden="true" /> Check in the Tablebase
            </button>
          )}
          {tablebaseProblem && (
            <p data-testid="tablebase-note" className="-mt-3 text-xs font-medium text-amber-300 leading-relaxed">
              {tablebaseProblem}
            </p>
          )}
        </div>
      }
    />
  );
}
