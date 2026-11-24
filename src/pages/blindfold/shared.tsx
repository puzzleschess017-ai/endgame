import type { Key } from 'chessground/types';
import ChessboardPanel from '../../components/ChessboardPanel';
import { segmentClass } from '../../components/panelUi';
import type { BoardTheme, PieceSet } from '../../types';

export type BlindfoldMode = 'mate' | 'drills';

/** Mate in 1 / Drills switch at the top of the panel. */
export function ModeTabs({
  mode,
  onChange,
}: {
  mode: BlindfoldMode;
  onChange: (mode: BlindfoldMode) => void;
}) {
  const items: Array<{ id: BlindfoldMode; label: string }> = [
    { id: 'mate', label: 'Mate in 1' },
    { id: 'drills', label: 'Drills' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          onClick={() => onChange(item.id)}
          className={segmentClass(mode === item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const NOOP = () => undefined;
const NO_DESTS = new Map<Key, Key[]>();

/** A board that only shows a position (nobody moves on it). */
export function ViewBoard({
  fen,
  orientation,
  lastMove,
  arrow,
  syncToken,
  boardTheme,
  pieceSet,
}: {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: [Key, Key];
  arrow?: [Key, Key] | null;
  syncToken: number;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
}) {
  return (
    <ChessboardPanel
      fen={fen}
      orientation={orientation}
      turnColor={orientation}
      dests={NO_DESTS}
      lastMove={lastMove}
      check={false}
      hintArrow={arrow ?? null}
      viewOnly
      syncToken={syncToken}
      boardTheme={boardTheme}
      pieceSet={pieceSet}
      onUserMove={NOOP}
      pendingPromotion={null}
      onSelectPromotion={NOOP}
      onCancelPromotion={NOOP}
    />
  );
}

export interface BlindfoldModeProps {
  username?: string;
  mode: BlindfoldMode;
  onModeChange: (mode: BlindfoldMode) => void;
}
