import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { isSilent, playSoundPreview, type SoundStyle } from '../utils/sound';

const STYLE_LABELS: { value: SoundStyle; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'electronic', label: 'Electronic' },
];

const POPOVER_WIDTH = 280;
const GAP = 10;

interface Position {
  left: number;
  top?: number;
  bottom?: number;
}

/**
 * The speaker button of the menu. It opens a small bubble with the volume slider and a mute switch.
 */
export default function SoundMenu() {
  const [settings, update] = useSoundSettings();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const silent = isSilent(settings);
  const percent = Math.round(settings.volume * 100);
  const Icon = silent ? VolumeX : settings.volume < 0.5 ? Volume1 : Volume2;

  // The bubble opens above the button when the button is in the lower half of the screen (the menu
  // panel's footer) and below it otherwise (the bar on top of small screens).
  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - POPOVER_WIDTH - 8, rect.right - POPOVER_WIDTH));
    if (rect.top > window.innerHeight / 2) {
      setPosition({ left, bottom: window.innerHeight - rect.top + GAP });
    } else {
      setPosition({ left, top: rect.bottom + GAP });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-white/85 hover:text-accent hover:bg-card border border-transparent hover:border-white/15 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
        aria-label="Sound settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={silent ? 'Sound settings (muted)' : 'Sound settings'}
      >
        <Icon className="w-4 h-4" />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Sound settings"
            style={{ left: position.left, top: position.top, bottom: position.bottom, width: POPOVER_WIDTH }}
            className="fixed z-50 rounded-2xl bg-card border border-white/15 shadow-[0_18px_48px_rgba(0,0,0,0.55)] p-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="sound-volume" className="text-sm font-bold text-white">
                  Volume
                </label>
                <span className="text-xs font-semibold text-white/70 tabular-nums" data-testid="sound-volume-value">
                  {settings.muted ? 'Muted' : `${percent}%`}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update({ muted: !settings.muted })}
                  className="p-2 rounded-xl bg-inset border border-white/15 hover:border-accent hover:text-accent text-white cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
                  aria-label={settings.muted ? 'Unmute sounds' : 'Mute sounds'}
                  aria-pressed={settings.muted}
                  title={settings.muted ? 'Unmute sounds' : 'Mute sounds'}
                >
                  {settings.muted || settings.volume <= 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  id="sound-volume"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={percent}
                  onChange={(e) => update({ volume: Number(e.target.value) / 100, muted: false })}
                  // Let go of the slider (mouse, finger or keyboard) and hear how loud that is.
                  onMouseUp={() => playSoundPreview()}
                  onTouchEnd={() => playSoundPreview()}
                  onKeyUp={(e) => {
                    if (/^(Arrow|Page)/.test(e.key) || e.key === 'Home' || e.key === 'End') playSoundPreview();
                  }}
                  className="flex-1 min-w-0 accent-accent cursor-pointer"
                  aria-valuetext={`${percent}%`}
                />
              </div>
            </div>

            <div className="mt-4">
              <span className="text-sm font-bold text-white">Sound</span>
              <div className="mt-2 grid grid-cols-2 gap-1 bg-inset p-1 rounded-xl border border-white/10" role="group" aria-label="Sound style">
                {STYLE_LABELS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`sound-style-${value}`}
                    aria-pressed={settings.style === value}
                    onClick={() => {
                      update({ style: value });
                      playSoundPreview();
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                      settings.style === value ? 'bg-accent text-snow' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
