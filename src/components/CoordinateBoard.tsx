import type { BoardTheme } from '../types';
import { BOARD_THEMES } from '../utils/appearance';
import { FILES, RANKS, isDarkSquare } from '../utils/coordinates';

export type SquareMark = 'target' | 'correct' | 'wrong';

interface CoordinateBoardProps {
  orientation: 'white' | 'black';
  theme: BoardTheme;
  showLabels: boolean;
  /** Overlay per square, e.g. { e4: 'target' }. */
  marks: Partial<Record<string, SquareMark>>;
  /** When set, every square is a button that reports its name. */
  onSquareClick?: (square: string) => void;
}

const MARK_CLASS: Record<SquareMark, string> = {
  target: 'bg-[#f5c542]/85',
  correct: 'bg-[#39ff88]/75',
  wrong: 'bg-[#ff5a5a]/75',
};

/** Empty, pieceless board made of plain HTML so it can be clicked square by square. */
export default function CoordinateBoard({
  orientation,
  theme,
  showLabels,
  marks,
  onSquareClick,
}: CoordinateBoardProps) {
  const colors = BOARD_THEMES.find((t) => t.id === theme) ?? BOARD_THEMES[0];
  const files = orientation === 'white' ? [...FILES] : [...FILES].reverse();
  const ranks = orientation === 'white' ? [...RANKS].reverse() : [...RANKS];

  return (
    <div
      role="group"
      aria-label="Chessboard"
      className="w-full aspect-square grid grid-cols-8 grid-rows-8 rounded-xl overflow-hidden border border-white/10 shadow-[0_16px_44px_rgba(4,9,20,0.45)] select-none"
    >
      {ranks.map((rank, rowIndex) =>
        files.map((file, colIndex) => {
          const square = `${file}${rank}`;
          const dark = isDarkSquare(square);
          const mark = marks[square];
          const showFile = showLabels && rowIndex === 7;
          const showRank = showLabels && colIndex === 0;
          const base = `relative min-w-0 min-h-0 ${dark ? colors.darkClass : colors.lightClass}`;
          const labelColor = dark ? 'text-white/85' : 'text-black/55';

          const content = (
            <>
              {mark && <span aria-hidden="true" className={`absolute inset-0 ${MARK_CLASS[mark]}`} />}
              {showRank && (
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 left-1 text-[10px] sm:text-xs font-bold leading-none ${labelColor}`}
                >
                  {rank}
                </span>
              )}
              {showFile && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-bold leading-none ${labelColor}`}
                >
                  {file}
                </span>
              )}
            </>
          );

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
              aria-label={showLabels ? `Square ${square}` : 'Board square'}
              onClick={() => onSquareClick(square)}
              className={`${base} cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#39ff88]`}
            >
              {content}
            </button>
          );
        }),
      )}
    </div>
  );
}
