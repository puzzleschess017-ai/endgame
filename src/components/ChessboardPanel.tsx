import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';

import type { BoardTheme, PieceSet } from '../types';

export interface PendingPromotion {
  from: Key;
  to: Key;
  color: 'white' | 'black';
}

interface ChessboardPanelProps {
  fen: string;
  orientation: 'white' | 'black';
  turnColor: 'white' | 'black';
  dests: Map<Key, Key[]>;
  lastMove?: [Key, Key];
  check: 'white' | 'black' | false;
  hintArrow: [Key, Key] | null;
  viewOnly: boolean;
  syncToken: number;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  onUserMove: (from: Key, to: Key) => void;
  pendingPromotion: PendingPromotion | null;
  onSelectPromotion: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancelPromotion: () => void;
}

const PROMO_PIECES: Array<{ role: 'q' | 'r' | 'b' | 'n'; name: string; svgCode: 'Q' | 'R' | 'B' | 'N' }> = [
  { role: 'q', name: 'Queen', svgCode: 'Q' },
  { role: 'r', name: 'Rook', svgCode: 'R' },
  { role: 'b', name: 'Bishop', svgCode: 'B' },
  { role: 'n', name: 'Knight', svgCode: 'N' },
];

const PROMO_LEFT_CLASSES = [
  'left-[0%]',
  'left-[12.5%]',
  'left-[25%]',
  'left-[37.5%]',
  'left-[50%]',
  'left-[62.5%]',
  'left-[75%]',
  'right-0',
];

export default function ChessboardPanel({
  fen,
  orientation,
  turnColor,
  dests,
  lastMove,
  check,
  hintArrow,
  viewOnly,
  syncToken,
  boardTheme,
  pieceSet,
  onUserMove,
  pendingPromotion,
  onSelectPromotion,
  onCancelPromotion,
}: ChessboardPanelProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cgApiRef = useRef<Api | null>(null);
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;
  const prevFenRef = useRef<string>(fen);
  const prevSyncTokenRef = useRef<number>(syncToken);
  const [boardPx, setBoardPx] = useState<number | null>(null);
  const [forcedDarkDetected, setForcedDarkDetected] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Detect browser-level forced dark mode (e.g. Samsung Internet / Force Dark)
  // that overrides SVG piece colors despite CSS color-scheme declarations.
  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.drawImage(img, 0, 0);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a > 200 && (r < 220 || g < 220 || b < 220)) {
          setForcedDarkDetected(true);
        }
      } catch {
        // Ignore canvas readback errors
      }
    };
    img.src =
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNmZmZmZmYiLz48L3N2Zz4=';

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    let rafId: number | null = null;

    const measure = () => {
      const rect = stageEl.getBoundingClientRect();
      const raw = Math.floor(Math.min(rect.width, rect.height));
      if (raw <= 0) return;
      const snapped = Math.max(8, Math.floor(raw / 8) * 8);
      setBoardPx((prev) => (prev === snapped ? prev : snapped));
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        rafId = window.requestAnimationFrame(measure);
      });
      ro.observe(stageEl);
      return () => {
        if (rafId !== null) window.cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }

    window.addEventListener('resize', measure);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    if (boardPx === null) return;
    const rafId = window.requestAnimationFrame(() => {
      cgApiRef.current?.redrawAll();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [boardPx]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const interactive = !viewOnly;
    const api = Chessground(el, {
      fen,
      orientation,
      turnColor,
      lastMove,
      check,
      viewOnly: false,
      coordinates: true,
      autoCastle: true,
      blockTouchScroll: true,
      animation: {
        enabled: true,
        duration: 180,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      movable: {
        free: false,
        color: interactive ? turnColor : undefined,
        dests: interactive ? dests : new Map(),
        showDests: true,
        events: {
          after: (orig, dest) => {
            onUserMoveRef.current(orig, dest);
          },
        },
      },
      draggable: {
        enabled: interactive,
        distance: 3,
        autoDistance: true,
        showGhost: true,
        deleteOnDropOff: false,
      },
      premovable: {
        enabled: false,
      },
      predroppable: {
        enabled: false,
      },
      selectable: {
        enabled: interactive,
      },
      drawable: {
        enabled: true,
        visible: true,
        autoShapes: hintArrow ? [{ orig: hintArrow[0], dest: hintArrow[1], brush: 'green' }] : [],
      },
    });

    cgApiRef.current = api;

    return () => {
      api.destroy();
      cgApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = cgApiRef.current;
    if (!api) return;

    const interactive = !viewOnly;
    const shouldClearSelection =
      !interactive || prevFenRef.current !== fen || prevSyncTokenRef.current !== syncToken;
    prevFenRef.current = fen;
    prevSyncTokenRef.current = syncToken;

    api.set({
      fen,
      orientation,
      turnColor,
      lastMove,
      check,
      ...(shouldClearSelection ? { selected: undefined } : {}),
      movable: {
        free: false,
        color: interactive ? turnColor : undefined,
        dests: interactive ? dests : new Map(),
        showDests: true,
        events: {
          after: (orig, dest) => {
            onUserMoveRef.current(orig, dest);
          },
        },
      },
      draggable: {
        enabled: interactive,
        distance: 3,
        autoDistance: true,
        showGhost: true,
        deleteOnDropOff: false,
      },
      premovable: {
        enabled: false,
      },
      predroppable: {
        enabled: false,
      },
      selectable: {
        enabled: interactive,
      },
      drawable: {
        enabled: true,
        visible: true,
        autoShapes: hintArrow ? [{ orig: hintArrow[0], dest: hintArrow[1], brush: 'green' }] : [],
      },
    });
  }, [fen, orientation, turnColor, dests, lastMove, check, hintArrow, viewOnly, syncToken]);

  useEffect(() => {
    if (!pendingPromotion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancelPromotion();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingPromotion, onCancelPromotion]);

  let promoHorizontalClass = PROMO_LEFT_CLASSES[0];
  let promoAtTop = true;
  if (pendingPromotion) {
    const fileIndex = pendingPromotion.to.charCodeAt(0) - 97;
    const col = Math.max(0, Math.min(7, orientation === 'white' ? fileIndex : 7 - fileIndex));
    promoHorizontalClass = PROMO_LEFT_CLASSES[col];
    promoAtTop = pendingPromotion.color === orientation;
  }

  const colorPrefix = pendingPromotion?.color === 'black' ? 'b' : 'w';

  return (
    <div className="w-full flex flex-col gap-2.5">
      {forcedDarkDetected && !warningDismissed && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl bg-[#16233b] border border-[#39ff88]/50 px-3.5 py-2.5 text-xs text-white/90 leading-snug shadow-sm"
        >
          <AlertTriangle className="w-4 h-4 text-[#39ff88] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="flex-1">
            Browser dark mode is altering board and piece colors. Turn off{' '}
            <span className="font-bold text-white">Dark mode for websites</span> in browser
            settings or open in Chrome for normal piece contrast.
          </p>
          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss dark mode warning"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        className={`board-shell board-theme-${boardTheme} piece-set-${pieceSet} relative w-full rounded-2xl border border-white/10 shadow-[0_14px_38px_rgba(4,9,20,0.5)] overflow-hidden bg-[#16233b] p-1`}
      >
        <div ref={stageRef} className="relative w-full aspect-square flex items-center justify-center">
          <div
            style={boardPx ? { width: `${boardPx}px`, height: `${boardPx}px` } : undefined}
            className={
              boardPx
                ? 'relative rounded-xl overflow-hidden shrink-0'
                : 'relative w-full h-full rounded-xl overflow-hidden'
            }
          >
            <div ref={containerRef} className="w-full h-full" />

            {pendingPromotion && (
              <div
                className="absolute inset-0 z-30 bg-[#101b2f]/60"
                onClick={onCancelPromotion}
                role="dialog"
                aria-modal="true"
                aria-label="Choose promotion piece"
              >
                <div
                  className={`absolute w-[12.5%] min-w-[44px] bg-[#dce3ef] border-2 border-[#39ff88] shadow-2xl overflow-hidden flex divide-y divide-[#101b2f]/15 ${
                    promoAtTop ? 'top-0 rounded-b-xl flex-col' : 'bottom-0 rounded-t-xl flex-col-reverse'
                  } ${promoHorizontalClass}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {PROMO_PIECES.map((p) => (
                    <button
                      key={p.role}
                      type="button"
                      onClick={() => onSelectPromotion(p.role)}
                      className="relative w-full aspect-square min-h-[44px] bg-[#dce3ef] hover:bg-[#39ff88]/45 active:bg-[#39ff88]/65 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#39ff88] transition-colors flex items-center justify-center cursor-pointer p-1"
                      aria-label={`Promote to ${p.name}`}
                      title={`Promote to ${p.name}`}
                    >
                      <img
                        src={`/pieces/${pieceSet}/${colorPrefix}${p.svgCode}.svg`}
                        alt={`${pendingPromotion.color} ${p.name}`}
                        className="w-[86%] h-[86%] object-contain pointer-events-none select-none"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
