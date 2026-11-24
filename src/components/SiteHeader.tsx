import { Volume2, VolumeX } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
}

// Every page is a normal link (full page load); the server serves the same app for all paths.
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Woodpecker' },
  { href: '/coordinates', label: 'Coordinates' },
  { href: '/streak', label: 'Streak' },
  { href: '/race', label: 'Race' },
];

function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

interface SiteHeaderProps {
  username?: string;
  muted: boolean;
  onToggleMute: () => void;
}

export default function SiteHeader({ username, muted, onToggleMute }: SiteHeaderProps) {
  const path = currentPath();

  return (
    <header className="border-b border-white/10 bg-[#0d1627]">
      <div className="max-w-[1220px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Chess Tactics Guide home">
          <img
            src="/assets/aistudio/Add_a_heading__16_-removebg-preview_c70fa2ca.png"
            alt="Chess Tactics Guide logo"
            className="w-7 h-7 object-contain select-none shrink-0"
            draggable={false}
          />
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Chess Tactics Guide
          </h1>
        </a>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0 min-w-0">
          {username && (
            <span className="text-xs sm:text-sm font-semibold text-white/90 whitespace-nowrap truncate max-w-[180px] sm:max-w-[280px]">
              Welcome, {username}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl text-white/85 hover:text-[#39ff88] hover:bg-[#16233b] border border-transparent hover:border-white/15 transition-all duration-150 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <nav aria-label="Training modes" className="max-w-[1220px] mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = item.href === path;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                active
                  ? 'border-[#39ff88] text-white'
                  : 'border-transparent text-white/70 hover:text-white hover:border-white/30'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
