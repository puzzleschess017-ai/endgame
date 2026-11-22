import { useCallback, useEffect, useRef, useState } from 'react';
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

const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const;

const ROLE_TO_CODE: Record<string, 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: 'P',
};

const BOARD_THEME_PALETTES: Record<
  BoardTheme,
  { light: string; dark: string; lastMove: string; coordLight: string; coordDark: string }
> = {
  green: {
    light: '#eeeed2',
    dark: '#769656',
    lastMove: 'rgba(155, 199, 0, 0.42)',
    coordLight: '#5b783e',
    coordDark: '#eeeed2',
  },
  brown: {
    light: '#f0d9b5',
    dark: '#b58863',
    lastMove: 'rgba(155, 199, 0, 0.42)',
    coordLight: '#8a6142',
    coordDark: '#f0d9b5',
  },
  blue: {
    light: '#dee3e6',
    dark: '#8ca2ad',
    lastMove: 'rgba(155, 199, 0, 0.41)',
    coordLight: '#4f6773',
    coordDark: '#dee3e6',
  },
  purple: {
    light: '#e6dff0',
    dark: '#7d5ba6',
    lastMove: 'rgba(210, 185, 40, 0.42)',
    coordLight: '#553978',
    coordDark: '#e6dff0',
  },
  grey: {
    light: '#e0e0e0',
    dark: '#888888',
    lastMove: 'rgba(165, 199, 40, 0.42)',
    coordLight: '#525252',
    coordDark: '#e0e0e0',
  },
  pink: {
    light: '#f4e1e6',
    dark: '#c26a85',
    lastMove: 'rgba(215, 185, 45, 0.42)',
    coordLight: '#823952',
    coordDark: '#f4e1e6',
  },
};

type PieceSprite = HTMLCanvasElement;

interface SvgCalibration {
  needsRestore: boolean;
  blackRgb: [number, number, number];
  whiteRgb: [number, number, number];
}

let cachedCalibration: Promise<SvgCalibration> | null = null;

function measureCalibrationSvg(): Promise<SvgCalibration> {
  return new Promise((resolve) => {
    const fallback: SvgCalibration = {
      needsRestore: false,
      blackRgb: [0, 0, 0],
      whiteRgb: [255, 255, 255],
    };

    const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect x="12" y="12" width="40" height="40" fill="#000000"/>
      <rect x="76" y="76" width="40" height="40" fill="#ffffff"/>
    </svg>`;

    const blob = new Blob([testSvg], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(fallback);
          return;
        }
        ctx.drawImage(img, 0, 0, 128, 128);
        const b = ctx.getImageData(32, 32, 1, 1).data;
        const w = ctx.getImageData(96, 96, 1, 1).data;
        if (b[3] < 200 || w[3] < 200) {
          resolve(fallback);
          return;
        }
        const blackRgb: [number, number, number] = [b[0], b[1], b[2]];
        const whiteRgb: [number, number, number] = [w[0], w[1], w[2]];
        const maxBlack = Math.max(b[0], b[1], b[2]);
        const minWhite = Math.min(w[0], w[1], w[2]);
        const needsRestore = (minWhite < 242 || maxBlack > 15) && minWhite > maxBlack + 20;
        resolve({ needsRestore, blackRgb, whiteRgb });
      } catch {
        resolve(fallback);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(fallback);
    };

    img.src = blobUrl;
  });
}

function getSvgCalibration(): Promise<SvgCalibration> {
  if (!cachedCalibration) {
    cachedCalibration = measureCalibrationSvg();
  }
  return cachedCalibration;
}

function restoreCanvasContrast(canvas: HTMLCanvasElement, cal: SvgCalibration): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const spanR = Math.max(1, cal.whiteRgb[0] - cal.blackRgb[0]);
    const spanG = Math.max(1, cal.whiteRgb[1] - cal.blackRgb[1]);
    const spanB = Math.max(1, cal.whiteRgb[2] - cal.blackRgb[2]);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = ((data[i] - cal.blackRgb[0]) / spanR) * 255;
      const g = ((data[i + 1] - cal.blackRgb[1]) / spanG) * 255;
      const b = ((data[i + 2] - cal.blackRgb[2]) / spanB) * 255;
      data[i] = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
    }
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // Ignore readback errors
  }
}

function measureOpaqueRange(canvas: HTMLCanvasElement): { min: number; max: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255;
    let max = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 245) continue;
      const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (luma < min) min = luma;
      if (luma > max) max = luma;
      count++;
    }
    if (count < 50) return null;
    return { min, max };
  } catch {
    return null;
  }
}

async function rasterizeSvgAtHiRes(url: string, size = 256): Promise<HTMLCanvasElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    let svgText = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.documentElement;
    if (svgEl && svgEl.nodeName.toLowerCase() === 'svg') {
      if (!svgEl.getAttribute('viewBox')) {
        const wAttr = parseFloat(svgEl.getAttribute('width') || '45') || 45;
        const hAttr = parseFloat(svgEl.getAttribute('height') || '45') || 45;
        svgEl.setAttribute('viewBox', `0 0 ${wAttr} ${hAttr}`);
      }
      svgEl.setAttribute('width', String(size));
      svgEl.setAttribute('height', String(size));
      svgText = new XMLSerializer().serializeToString(svgEl);
    }

    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = blobUrl;
      });
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      return c;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, size, size);
        resolve(c);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
}

function keyToRowCol(key: Key, orientation: 'white' | 'black'): { row: number; col: number } | null {
  if (key.length < 2) return null;
  const fileIdx = key.charCodeAt(0) - 97;
  const rankIdx = Number(key[1]) - 1;
  if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7 || Number.isNaN(rankIdx)) {
    return null;
  }
  return orientation === 'white'
    ? { row: 7 - rankIdx, col: fileIdx }
    : { row: rankIdx, col: 7 - fileIdx };
}

function PromotionPieceCanvas({
  sprite,
  label,
}: {
  sprite?: PieceSprite;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = 64;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size, size);
    if (sprite) {
      ctx.drawImage(sprite, 0, 0, size, size);
    }
  }, [sprite]);

  return (
    <canvas
      ref={ref}
      aria-label={label}
      className="w-[86%] h-[86%] pointer-events-none select-none"
    />
  );
}

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
  const boardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const piecesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cgApiRef = useRef<Api | null>(null);
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;
  const drawPiecesRef = useRef<() => void>(() => {});
  const prevFenRef = useRef<string>(fen);
  const prevSyncTokenRef = useRef<number>(syncToken);
  const spritesRef = useRef<Map<string, PieceSprite>>(new Map());
  const [spritesVersion, setSpritesVersion] = useState(0);
  const [boardPx, setBoardPx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nextMap = new Map<string, PieceSprite>();
    spritesRef.current = nextMap;

    (async () => {
      const cal = await getSvgCalibration();
      if (cancelled) return;

      const entries = await Promise.all(
        PIECE_CODES.map(async (code) => {
          const canvas = await rasterizeSvgAtHiRes(`/pieces/${pieceSet}/${code}.svg`, 256);
          return [code, canvas] as const;
        })
      );
      if (cancelled) return;

      let effectiveCal = cal;
      if (!effectiveCal.needsRestore) {
        const whiteSample =
          entries.find(([c, cv]) => c === 'wP' && cv)?.[1] ??
          entries.find(([c, cv]) => c === 'wK' && cv)?.[1];
        if (whiteSample) {
          const range = measureOpaqueRange(whiteSample);
          if (range && range.max < 215 && range.max > range.min + 20) {
            effectiveCal = {
              needsRestore: true,
              blackRgb: [range.min, range.min, range.min],
              whiteRgb: [range.max, range.max, range.max],
            };
          }
        }
      }

      for (const [code, canvas] of entries) {
        if (!canvas) continue;
        if (effectiveCal.needsRestore) {
          restoreCanvasContrast(canvas, effectiveCal);
        }
        nextMap.set(code, canvas);
      }

      if (!cancelled) {
        setSpritesVersion((v) => v + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pieceSet]);

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
    const canvas = boardCanvasRef.current;
    if (!canvas || !boardPx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(boardPx * dpr);
    canvas.height = Math.round(boardPx * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const palette = BOARD_THEME_PALETTES[boardTheme] ?? BOARD_THEME_PALETTES.green;
    const sq = boardPx / 8;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        ctx.fillStyle = isLight ? palette.light : palette.dark;
        ctx.fillRect(col * sq, row * sq, sq, sq);
      }
    }

    if (lastMove) {
      ctx.fillStyle = palette.lastMove;
      for (const k of lastMove) {
        const rc = keyToRowCol(k, orientation);
        if (rc) {
          ctx.fillRect(rc.col * sq, rc.row * sq, sq, sq);
        }
      }
    }

    const fontSize = Math.max(9, Math.min(12, Math.round(boardPx * 0.024)));
    ctx.font = `700 ${fontSize}px Futura, "Futura PT", "Century Gothic", "Trebuchet MS", sans-serif`;

    const files =
      orientation === 'white'
        ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
    const ranks =
      orientation === 'white'
        ? ['8', '7', '6', '5', '4', '3', '2', '1']
        : ['1', '2', '3', '4', '5', '6', '7', '8'];

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    for (let col = 0; col < 8; col++) {
      const isLight = (7 + col) % 2 === 0;
      ctx.fillStyle = isLight ? palette.coordLight : palette.coordDark;
      ctx.fillText(files[col], col * sq + 3, boardPx - 2);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    for (let row = 0; row < 8; row++) {
      const isLight = (row + 7) % 2 === 0;
      ctx.fillStyle = isLight ? palette.coordLight : palette.coordDark;
      ctx.fillText(ranks[row], boardPx - 3, row * sq + 3);
    }
  }, [boardPx, boardTheme, orientation, lastMove]);

  const drawPiecesCanvas = useCallback(() => {
    const canvas = piecesCanvasRef.current;
    const containerEl = containerRef.current;
    if (!canvas || !containerEl || !boardPx) return;

    const boardEl = containerEl.querySelector('cg-board');
    if (!boardEl) return;

    const boardRect = boardEl.getBoundingClientRect();
    if (boardRect.width <= 0 || boardRect.height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const targetW = Math.round(boardPx * dpr);
    const targetH = Math.round(boardPx * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, boardPx, boardPx);

    const pieces = boardEl.querySelectorAll('piece');
    const draggingPieces: HTMLElement[] = [];

    const drawOnePiece = (el: HTMLElement) => {
      const color = el.classList.contains('white')
        ? 'w'
        : el.classList.contains('black')
          ? 'b'
          : null;
      if (!color) return;

      let roleChar: string | null = null;
      for (const [roleClass, code] of Object.entries(ROLE_TO_CODE)) {
        if (el.classList.contains(roleClass)) {
          roleChar = code;
          break;
        }
      }
      if (!roleChar) return;

      const sprite = spritesRef.current.get(`${color}${roleChar}`);
      if (!sprite) return;

      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;

      const x = r.left - boardRect.left;
      const y = r.top - boardRect.top;

      ctx.save();
      if (el.classList.contains('ghost')) {
        ctx.globalAlpha = 0.32;
      } else if (el.classList.contains('fading')) {
        ctx.globalAlpha = 0.45;
      }
      ctx.drawImage(sprite, x, y, r.width, r.height);
      ctx.restore();
    };

    for (const node of pieces) {
      const el = node as HTMLElement;
      if (el.classList.contains('dragging')) {
        draggingPieces.push(el);
      } else {
        drawOnePiece(el);
      }
    }

    for (const el of draggingPieces) {
      drawOnePiece(el);
    }
  }, [boardPx]);

  drawPiecesRef.current = drawPiecesCanvas;

  useEffect(() => {
    if (boardPx === null) return;
    const rafId = window.requestAnimationFrame(() => {
      cgApiRef.current?.redrawAll();
      drawPiecesRef.current();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [boardPx, drawPiecesCanvas]);

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
      coordinates: false,
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

    let scheduledRaf: number | null = null;
    const schedulePiecesDraw = () => {
      if (scheduledRaf !== null) return;
      scheduledRaf = window.requestAnimationFrame(() => {
        scheduledRaf = null;
        drawPiecesRef.current();
      });
    };

    // Observe the outer container (never replaced by Chessground redrawAll)
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(schedulePiecesDraw);
      observer.observe(el, {
        childList: true,
        attributes: true,
        subtree: true,
        attributeFilter: ['style', 'class'],
      });
    }

    // Continuous 60fps sync while pointer/touch is dragging (+250ms tail for snap-back)
    let pointerActive = false;
    let dragLoopRaf: number | null = null;
    let tailUntil = 0;

    const runDragLoop = () => {
      dragLoopRaf = null;
      drawPiecesRef.current();
      if (pointerActive || performance.now() < tailUntil) {
        dragLoopRaf = window.requestAnimationFrame(runDragLoop);
      }
    };

    const startDragLoop = () => {
      pointerActive = true;
      if (dragLoopRaf === null) {
        dragLoopRaf = window.requestAnimationFrame(runDragLoop);
      }
    };

    const stopDragLoop = () => {
      if (!pointerActive) return;
      pointerActive = false;
      tailUntil = performance.now() + 250;
      if (dragLoopRaf === null) {
        dragLoopRaf = window.requestAnimationFrame(runDragLoop);
      }
    };

    el.addEventListener('pointerdown', startDragLoop, { passive: true });
    el.addEventListener('touchstart', startDragLoop, { passive: true });
    el.addEventListener('mousedown', startDragLoop, { passive: true });
    window.addEventListener('pointerup', stopDragLoop, { passive: true });
    window.addEventListener('pointercancel', stopDragLoop, { passive: true });
    window.addEventListener('touchend', stopDragLoop, { passive: true });
    window.addEventListener('touchcancel', stopDragLoop, { passive: true });
    window.addEventListener('mouseup', stopDragLoop, { passive: true });

    schedulePiecesDraw();

    return () => {
      if (scheduledRaf !== null) window.cancelAnimationFrame(scheduledRaf);
      if (dragLoopRaf !== null) window.cancelAnimationFrame(dragLoopRaf);
      el.removeEventListener('pointerdown', startDragLoop);
      el.removeEventListener('touchstart', startDragLoop);
      el.removeEventListener('mousedown', startDragLoop);
      window.removeEventListener('pointerup', stopDragLoop);
      window.removeEventListener('pointercancel', stopDragLoop);
      window.removeEventListener('touchend', stopDragLoop);
      window.removeEventListener('touchcancel', stopDragLoop);
      window.removeEventListener('mouseup', stopDragLoop);
      observer?.disconnect();
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

    let rafId = 0;
    const endAt = performance.now() + 230;
    const tick = () => {
      drawPiecesRef.current();
      if (performance.now() < endAt) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [fen, orientation, turnColor, dests, lastMove, check, hintArrow, viewOnly, syncToken, drawPiecesCanvas]);

  useEffect(() => {
    drawPiecesRef.current();
  }, [spritesVersion, drawPiecesCanvas]);

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
            <canvas
              ref={boardCanvasRef}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
            />

            <div ref={containerRef} className="w-full h-full relative" />

            <canvas
              ref={piecesCanvasRef}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
            />

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
                      <PromotionPieceCanvas
                        sprite={spritesRef.current.get(`${colorPrefix}${p.svgCode}`)}
                        label={`${pendingPromotion.color} ${p.name}`}
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
