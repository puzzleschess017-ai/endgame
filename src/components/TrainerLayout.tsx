import { useState } from 'react';
import type { ReactNode } from 'react';
import { Minus, Plus, Settings } from 'lucide-react';
import type { AppearanceSettings } from '../types';
import { boardSizeClassFor, stepBoardSize } from '../utils/appearance';
import AppShell from './AppShell';
import AppearanceSettingsModal from './AppearanceSettingsModal';

interface TrainerLayoutProps {
  username?: string;
  /** Board size, colours and piece set (from `useAppearance`). */
  appearance: AppearanceSettings;
  onAppearanceChange: (next: AppearanceSettings) => void;
  /** The board itself. */
  board: ReactNode;
  /** Right-hand panel (setup, run info, results). */
  panel: ReactNode;
  /** Under the board and its size buttons, in the same column (it does not scroll with the panel). */
  belowBoard?: ReactNode;
  /** Modals and other overlays. */
  children?: ReactNode;
}

const ROUND_BUTTON_CLASS =
  'p-2 rounded-xl bg-[#16233b] border border-white/15 hover:border-[#39ff88] hover:text-[#39ff88] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all duration-150 shadow-sm cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center';

/**
 * Page frame shared by Woodpecker and every training mode: the menu bar on top, then the board and
 * the right-hand panel, always in the same place and the same width. Under the board sit the board
 * size buttons and the board settings (colours, pieces), so every mode can resize its board.
 * New modes should use this too.
 */
export default function TrainerLayout({
  username,
  appearance,
  onAppearanceChange,
  board,
  panel,
  belowBoard,
  children,
}: TrainerLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const smaller = stepBoardSize(appearance.boardSize, -1);
  const larger = stepBoardSize(appearance.boardSize, 1);
  const resize = (boardSize: number) => onAppearanceChange({ ...appearance, boardSize });

  return (
    <>
      <AppShell username={username}>
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-8 pt-1 xl:pt-0">
          <section
            className={`w-full ${boardSizeClassFor(appearance.boardSize)} transition-[max-width] duration-200 ease-out flex flex-col gap-3 shrink-0`}
          >
            {board}

            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2" role="group" aria-label="Board size">
                <button
                  type="button"
                  onClick={() => resize(smaller)}
                  disabled={smaller === appearance.boardSize}
                  className={ROUND_BUTTON_CLASS}
                  aria-label="Decrease board size"
                  title="Decrease board size"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => resize(larger)}
                  disabled={larger === appearance.boardSize}
                  className={ROUND_BUTTON_CLASS}
                  aria-label="Increase board size"
                  title="Increase board size"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className={ROUND_BUTTON_CLASS}
                aria-label="Board settings"
                title="Board settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {belowBoard}
          </section>

          <aside className="w-full max-w-[560px] lg:w-[370px] shrink-0">{panel}</aside>
        </div>
      </AppShell>

      <AppearanceSettingsModal
        open={settingsOpen}
        settings={appearance}
        onChange={onAppearanceChange}
        onClose={() => setSettingsOpen(false)}
      />
      {children}
    </>
  );
}
