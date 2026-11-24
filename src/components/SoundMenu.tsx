import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { SOUND_STYLES, isSilent, playSoundPreview } from '../utils/sound';
import type { SoundStyle } from '../utils/sound';

const POPOVER_WIDTH = 280;
const GAP = 10;

interface Position {
  left: number;
  top?: number;
  bottom?: number;
}

/**
 * The speaker button of the menu. It opens a small bubble with the volume slider, a mute switch and
 * the choice between the Robotic and the Classic sound.
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

  const chooseStyle = (style: SoundStyle) => {
    update({ style });
    // Hear it right away (even if muted, since the person is choosing a sound).
    playSoundPreview(style);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-white/85 hover:text-[#39ff88] hover:bg-[#16233b] border border-transparent hover:border-white/15 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
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
            className="fixed z-50 rounded-2xl bg-[#16233b] border border-white/15 shadow-[0_18px_48px_rgba(0,0,0,0.55)] p-4 flex flex-col gap-4"
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
                  className="p-2 rounded-xl bg-[#101b2f] border border-white/15 hover:border-[#39ff88] hover:text-[#39ff88] text-white cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0"
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
                  className="flex-1 min-w-0 accent-[#39ff88] cursor-pointer"
                  aria-valuetext={`${percent}%`}
                />
              </div>
            </div>

            <div>
              <span className="text-sm font-bold text-white" id="sound-style-label">
                Sound
              </span>
              <div
                className="mt-2.5 grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10"
                role="radiogroup"
                aria-labelledby="sound-style-label"
              >
                {SOUND_STYLES.map((style) => {
                  const active = settings.style === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => chooseStyle(style.id)}
                      className={`py-2 px-2.5 rounded-lg text-left transition-all duration-150 cursor-pointer min-h-[46px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                        active ? 'bg-[#39ff88] text-[#101b2f] shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="text-sm font-bold leading-tight">{style.name}</div>
                      <div className={`text-[11px] font-semibold leading-tight mt-0.5 ${active ? 'text-[#101b2f]/75' : 'text-white/60'}`}>
                        {style.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
