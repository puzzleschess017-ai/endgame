import type { ReactNode } from 'react';
import AppShell from './AppShell';

interface TrainerLayoutProps {
  username?: string;
  muted: boolean;
  onToggleMute: () => void;
  /** Width class for the board column, from BOARD_SIZE_CLASS_MAP. */
  boardSizeClass: string;
  /** The board itself. */
  board: ReactNode;
  /** Optional controls under the board. */
  belowBoard?: ReactNode;
  /** Right-hand panel (setup, run info, results). */
  panel: ReactNode;
  /** Modals and other overlays. */
  children?: ReactNode;
}

/**
 * Page frame shared by Woodpecker and every training mode: the menu on the left, then the board and
 * the right-hand panel, always in the same place and the same width. New modes should use this too.
 */
export default function TrainerLayout({
  username,
  muted,
  onToggleMute,
  boardSizeClass,
  board,
  belowBoard,
  panel,
  children,
}: TrainerLayoutProps) {
  return (
    <>
      <AppShell username={username} muted={muted} onToggleMute={onToggleMute}>
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-8 pt-1 xl:pt-0">
          <section
            className={`w-full ${boardSizeClass} transition-[max-width] duration-200 ease-out flex flex-col gap-3 shrink-0`}
          >
            {board}
            {belowBoard}
          </section>

          <aside className="w-full max-w-[560px] lg:w-[370px] shrink-0">{panel}</aside>
        </div>
      </AppShell>
      {children}
    </>
  );
}
