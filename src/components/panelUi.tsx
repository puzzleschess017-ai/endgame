import type { ReactNode } from 'react';

// Small building blocks for the right-hand panel of every training page, so they all look alike.

export const CARD_CLASS =
  'bg-card border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_16px_44px_rgba(131,24,67,0.14)]';

/** Tighter card for the tool pages, so the whole panel fits next to the board without scrolling. */
export const COMPACT_CARD_CLASS =
  'bg-card border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-[0_16px_44px_rgba(131,24,67,0.14)]';

/** Card of a setup panel (Woodpecker, Blindfold): tighter still, so every choice and the Start button fit on one screen. */
export const SETUP_CARD_CLASS =
  'bg-card border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-[0_16px_44px_rgba(131,24,67,0.14)]';

/** Description under the title of a setup panel: small, so the whole setup fits on one screen. */
export const SETUP_TEXT_CLASS = 'mt-1 text-[13px] font-medium text-white/75 leading-snug';

/** Start button of a setup panel (a little lower than the usual one). */
export const START_BUTTON_CLASS =
  'btn-shine w-full py-3 px-5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-snow font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(219,39,119,0.22)] cursor-pointer min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const PRIMARY_BUTTON_CLASS =
  'btn-shine w-full py-3.5 px-5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-snow font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(219,39,119,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** The Login button: the same shape as the green primary button, in dark plum, so "Login" is never taken for "Start". */
export const LOGIN_BUTTON_CLASS =
  'btn-shine [--glow:36,18,29] w-full py-3.5 px-5 rounded-xl bg-white hover:bg-white/85 disabled:opacity-60 disabled:cursor-not-allowed text-snow font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(36,18,29,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export const SECONDARY_BUTTON_CLASS =
  'w-full py-2.5 px-3.5 rounded-xl bg-inset border border-white/20 hover:border-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20 text-white text-sm font-semibold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-accent';

/** Button inside a segmented control (time, side...). `dense` is the lowest one, for setup panels that must fit on a screen. */
export function segmentClass(active: boolean, compact = false, dense = false): string {
  return `${dense ? 'py-1 px-2 min-h-[32px]' : compact ? 'py-1.5 px-2 min-h-[36px]' : 'py-2 px-2 min-h-[40px]'} rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent ${
    active ? 'bg-accent text-snow shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/10'
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
  const color = tone === 'good' ? 'text-accent' : tone === 'bad' ? 'text-danger' : 'text-white';
  return (
    <div className="bg-inset border border-white/10 rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-white/65">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

/** The frame of a row of choices (use with `segmentClass(active, true, true)` buttons). */
export const SEGMENT_FRAME_CLASS = 'gap-1 bg-inset p-1 rounded-xl border border-white/10';

/** One setting on one line: its name on the left, the choices on the right. Keeps a setup panel short. */
export function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-[13px] font-semibold leading-tight text-white">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
