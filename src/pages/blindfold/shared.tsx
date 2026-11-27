import type { Key } from 'chessground/types';
import { Lock } from 'lucide-react';
import ChessboardPanel from '../../components/ChessboardPanel';
import { LOCKED_CLASS, LockMark, UnlockNotice, useLocks } from '../../components/locks';
import { SEGMENT_FRAME_CLASS, START_BUTTON_CLASS, segmentClass } from '../../components/panelUi';
import { useAuth } from '../../auth';
import { tierFor, unlockHint } from '../../utils/access';
import { DRILL_KINDS, drillDescription, drillLabel, type DrillKind } from '../../utils/drills';
import type { BoardTheme, PieceSet } from '../../types';

export type BlindfoldMode = 'mate' | 'drills';

/** Checkmate / Drills switch at the top of the panel. */
export function ModeTabs({
  mode,
  onChange,
}: {
  mode: BlindfoldMode;
  onChange: (mode: BlindfoldMode) => void;
}) {
  const items: Array<{ id: BlindfoldMode; label: string }> = [
    { id: 'mate', label: 'Checkmate' },
    { id: 'drills', label: 'Drills' },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 bg-inset p-1.5 rounded-xl border border-white/10" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={mode === item.id}
          onClick={() => onChange(item.id)}
          className={segmentClass(mode === item.id, true)}
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

/** The choice of drill (with the locks of the visitor's plan), shared by the timed drills and the rebuild drill. */
export function DrillPicker({ kind, onChange }: { kind: DrillKind; onChange: (kind: DrillKind) => void }) {
  const { tier } = useAuth();
  const locks = useLocks(tier);
  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold text-white">Drill</span>
      <div className={`grid grid-cols-2 ${SEGMENT_FRAME_CLASS}`}>
        {DRILL_KINDS.map((k) => {
          const needs = tierFor((a) => a.blindfold.drills, k);
          const locked = locks.isLocked(needs);
          return (
            <button
              key={k}
              type="button"
              data-testid={`drill-${k}`}
              aria-pressed={kind === k}
              aria-disabled={locked || undefined}
              title={locked ? unlockHint(tier, needs) : undefined}
              onClick={locks.choose(`The “${drillLabel(k)}” drill`, needs, () => onChange(k))}
              className={`${segmentClass(kind === k, true, true)} ${locked ? LOCKED_CLASS : ''} !whitespace-normal !text-[13px] leading-tight`}
            >
              {drillLabel(k)}
              {locked && <LockMark small />}
            </button>
          );
        })}
      </div>
      <UnlockNotice notice={locks.notice} />
      <p className="text-[13px] font-medium text-white/75 leading-snug">{drillDescription(kind)}</p>
    </div>
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
    <div className="flex flex-col gap-1.5" data-testid="blindfold-guest">
      <a
        href={`/login?tab=signup&next=${next}`}
        data-testid="blindfold-create"
        className={`${START_BUTTON_CLASS} flex items-center justify-center gap-2 no-underline`}
      >
        <Lock aria-hidden="true" className="h-4 w-4" /> Create a free account to play
      </a>
      <p className="text-center text-[13px] font-semibold text-white/75">
        Free, no card needed.{' '}
        <a
          href={`/login?next=${next}`}
          data-testid="blindfold-sign-in"
          className="text-white/85 hover:text-white underline underline-offset-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
        >
          I already have an account
        </a>
      </p>
    </div>
  );
}
