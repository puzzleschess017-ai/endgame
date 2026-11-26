import type { ReactNode } from 'react';

// Small building blocks for the right-hand panel of every training page, so they all look alike.

export const CARD_CLASS =
  'bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Tighter card for the tool pages, so the whole panel fits next to the board without scrolling. */
export const COMPACT_CARD_CLASS =
  'bg-[#16233b] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Card of a setup panel (Woodpecker, Blindfold): tighter still, so every choice and the Start button fit on one screen. */
export const SETUP_CARD_CLASS =
  'bg-[#16233b] border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Description under the title of a setup panel: small, so the whole setup fits on one screen. */
export const SETUP_TEXT_CLASS = 'mt-1 text-[13px] font-medium text-white/75 leading-snug';

/** Start button of a setup panel (a little lower than the usual one). */
export const START_BUTTON_CLASS =
  'btn-shine w-full py-3 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] disabled:opacity-60 disabled:cursor-not-allowed text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]';

export const PRIMARY_BUTTON_CLASS =
  'btn-shine w-full py-3.5 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] disabled:opacity-60 disabled:cursor-not-allowed text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]';

/** The Login button: the same shape as the green primary button, in light blue, so "Login" is never taken for "Start". */
export const LOGIN_BUTTON_CLASS =
  'btn-shine [--glow:125,211,252] w-full py-3.5 px-5 rounded-xl bg-sky-300 hover:bg-sky-200 disabled:opacity-60 disabled:cursor-not-allowed text-[#0b1a33] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(125,211,252,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300';

export const SECONDARY_BUTTON_CLASS =
  'w-full py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20 text-white text-sm font-semibold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88]';

/** Button inside a segmented control (time, side...). `dense` is the lowest one, for setup panels that must fit on a screen. */
export function segmentClass(active: boolean, compact = false, dense = false): string {
  return `${dense ? 'py-1 px-2 min-h-[32px]' : compact ? 'py-1.5 px-2 min-h-[36px]' : 'py-2 px-2 min-h-[40px]'} rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
    active ? 'bg-[#39ff88] text-[#101b2f] shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/10'
  }`;
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  const color = tone === 'good' ? 'text-[#39ff88]' : tone === 'bad' ? 'text-[#ff7a7a]' : 'text-white';
  return (
    <div className="bg-[#101b2f] border border-white/10 rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-white/65">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

/** The frame of a row of choices (use with `segmentClass(active, true, true)` buttons). */
export const SEGMENT_FRAME_CLASS = 'gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10';

/** One setting on one line: its name on the left, the choices on the right. Keeps a setup panel short. */
export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-[13px] font-semibold leading-tight text-white">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
