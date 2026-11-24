import { useEffect, useRef, useState } from 'react';
import type { BoardTheme } from '../types';
import { BOARD_FRAME_CLASS, BOARD_THEMES, snapBoardSize } from '../utils/appearance';
import { FILES, RANKS, isDarkSquare } from '../utils/coordinates';

export type SquareMark = 'correct' | 'wrong';

interface CoordinateBoardProps {
  orientation: 'white' | 'black';
  theme: BoardTheme;
  /** Overlay per square, e.g. { e4: 'correct' }. */
  marks: Partial<Record<string, SquareMark>>;
  /** When set, every square is a button that reports its name. */
  onSquareClick?: (square: string) => void;
}

const MARK_CLASS: Record<SquareMark, string> = {
  correct: 'bg-[#39ff88]/75',
  wrong: 'bg-[#ff5a5a]/75',
};

/**
 * Empty, pieceless board made of plain HTML so it can be clicked square by square.
 * It deliberately has no file or rank labels: the point is to learn the squares without them.
 */
export default function CoordinateBoard({
  orientation,
  theme,
  marks,
  onSquareClick,
}: CoordinateBoardProps) {
  const colors = BOARD_THEMES.find((t) => t.id === theme) ?? BOARD_THEMES[0];
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [boardPx, setBoardPx] = useState<number | null>(null);

  // Same measuring rule as the Woodpecker board, so both are exactly the same size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const snapped = snapBoardSize(Math.min(rect.width, rect.height));
      if (snapped !== null) setBoardPx((prev) => (prev === snapped ? prev : snapped));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const files = orientation === 'white' ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];

  return (
    <div ref={wrapRef} className="w-full aspect-square flex items-center justify-center">
      <div
        role="group"
        aria-label="Chessboard"
        style={boardPx ? { width: `${boardPx}px`, height: `${boardPx}px` } : undefined}
        className={`${boardPx ? 'shrink-0' : 'w-full h-full'} grid grid-cols-8 grid-rows-8 select-none ${BOARD_FRAME_CLASS}`}
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = `${file}${rank}`;
            const dark = isDarkSquare(square);
            const mark = marks[square];
            const base = `relative min-w-0 min-h-0 ${dark ? colors.darkClass : colors.lightClass}`;

            const content = mark ? (
              <span aria-hidden="true" className={`absolute inset-0 ${MARK_CLASS[mark]}`} />
            ) : null;

            if (!onSquareClick) {
              return (
                <div key={square} data-square={square} className={base}>
                  {content}
                </div>
              );
            }

            return (
              <button
                key={square}
                type="button"
                data-square={square}
                aria-label="Board square"
                onClick={() => onSquareClick(square)}
                className={`${base} cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#39ff88]`}
              >
                {content}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
