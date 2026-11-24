import type { Key } from 'chessground/types';
import { Lock } from 'lucide-react';
import ChessboardPanel from '../../components/ChessboardPanel';
import { PRIMARY_BUTTON_CLASS, segmentClass } from '../../components/panelUi';
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

/**
 * What a guest sees in place of the Start button: Blindfold looks the same as for everybody, with every
 * choice locked, and a free account opens it.
 */
export function GuestStart() {
  const next = encodeURIComponent('/blindfold');
  return (
    <div className="flex flex-col gap-2.5" data-testid="blindfold-guest">
      <p className="flex items-start gap-2 text-sm font-semibold text-white/85 leading-snug">
        <Lock aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0 text-[#39ff88]" />
        Blindfold training is free with an account: create one in a minute, no card needed.
      </p>
      <a
        href={`/login?tab=signup&next=${next}`}
        data-testid="blindfold-create"
        className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center gap-2 no-underline`}
      >
        <Lock aria-hidden="true" className="h-4 w-4" /> Create a free account to play
      </a>
      <a
        href={`/login?next=${next}`}
        data-testid="blindfold-sign-in"
        className="text-center text-sm font-semibold text-white/75 hover:text-white underline underline-offset-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#39ff88]"
      >
        I already have an account
      </a>
    </div>
  );
}
