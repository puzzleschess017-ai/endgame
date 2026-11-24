// Small building blocks for the right-hand panel of every training page, so they all look alike.

export const CARD_CLASS =
  'bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Tighter card for the tool pages, so the whole panel fits next to the board without scrolling. */
export const COMPACT_CARD_CLASS =
  'bg-[#16233b] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Description under the title of a setup panel: small, so the whole setup fits on one screen. */
export const SETUP_TEXT_CLASS = 'mt-1 text-[13px] font-medium text-white/75 leading-snug';

/** Start button of a setup panel (a little lower than the usual one). */
export const START_BUTTON_CLASS =
  'w-full py-3 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] disabled:opacity-60 disabled:cursor-not-allowed text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]';

export const PRIMARY_BUTTON_CLASS =
  'w-full py-3.5 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] disabled:opacity-60 disabled:cursor-not-allowed text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]';

export const SECONDARY_BUTTON_CLASS =
  'w-full py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20 text-white text-sm font-semibold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88]';

/** Button inside a segmented control (time, side...). */
export function segmentClass(active: boolean, compact = false): string {
  return `${compact ? 'py-1.5 px-2 min-h-[36px]' : 'py-2 px-2 min-h-[40px]'} rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
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
