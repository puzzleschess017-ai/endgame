import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { AppearanceSettings } from '../types';
import { BOARD_THEMES, PIECE_SETS, saveAppearanceSettings } from '../utils/appearance';

interface AppearanceSettingsModalProps {
  open: boolean;
  settings: AppearanceSettings;
  onChange: (next: AppearanceSettings) => void;
  onClose: () => void;
}

export default function AppearanceSettingsModal({
  open,
  settings,
  onChange,
  onClose,
}: AppearanceSettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelectTheme = (themeId: typeof settings.boardTheme) => {
    const next = { ...settings, boardTheme: themeId };
    onChange(next);
    saveAppearanceSettings(next);
  };

  const handleSelectPieceSet = (pieceSetId: typeof settings.pieceSet) => {
    const next = { ...settings, pieceSet: pieceSetId };
    onChange(next);
    saveAppearanceSettings(next);
  };

  const handleDone = () => {
    saveAppearanceSettings(settings);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060c17]/75 backdrop-blur-[2px] p-4"
      onClick={handleDone}
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-settings-title"
    >
      <div
        className="w-full max-w-[500px] bg-[#16233b] border border-white/15 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 id="board-settings-title" className="text-base font-bold text-white">
            Board Appearance
          </h2>
          <button
            type="button"
            onClick={handleDone}
            className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Board Colors */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-white">Board Colors</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {BOARD_THEMES.map((theme) => {
                const active = settings.boardTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer min-h-[46px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                      active
                        ? 'bg-[#39ff88]/15 border-[#39ff88] text-white'
                        : 'bg-[#101b2f] border-white/10 text-white/85 hover:border-white/40 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-md overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 border border-black/25"
                      aria-hidden="true"
                    >
                      <span className={theme.lightClass} />
                      <span className={theme.darkClass} />
                      <span className={theme.darkClass} />
                      <span className={theme.lightClass} />
                    </span>
                    <span className="text-sm font-semibold truncate">{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Piece Sets */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-white">Piece Set</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PIECE_SETS.map((set) => {
                const active = settings.pieceSet === set.id;
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => handleSelectPieceSet(set.id)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer min-h-[84px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                      active
                        ? 'bg-[#39ff88]/15 border-[#39ff88] text-white'
                        : 'bg-[#101b2f] border-white/10 text-white/85 hover:border-white/40 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#233454]">
                      <img
                        src={`/pieces/${set.id}/wN.svg`}
                        alt={`${set.name} white knight`}
                        className="w-7 h-7 object-contain select-none"
                        draggable={false}
                      />
                      <img
                        src={`/pieces/${set.id}/bQ.svg`}
                        alt={`${set.name} black queen`}
                        className="w-7 h-7 object-contain select-none"
                        draggable={false}
                      />
                    </div>
                    <span className="text-sm font-semibold">{set.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="px-5 py-3.5 border-t border-white/10 bg-[#132038] flex justify-end">
          <button
            type="button"
            onClick={handleDone}
            className="px-5 py-2.5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] text-sm font-bold transition-all duration-150 cursor-pointer min-h-[40px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
