// Small building blocks for the right-hand panel of every training page, so they all look alike.

export const CARD_CLASS =
  'bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

export const PRIMARY_BUTTON_CLASS =
  'w-full py-3.5 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] disabled:opacity-60 disabled:cursor-not-allowed text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]';

export const SECONDARY_BUTTON_CLASS =
  'w-full py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20 text-white text-sm font-semibold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-[#39ff88]';

/** Button inside a segmented control (time, side...). */
export function segmentClass(active: boolean): string {
  return `py-2 px-2 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
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
