import { useEffect } from 'react';
import {
  Bird,
  EyeOff,
  Flame,
  Grid3x3,
  LayoutDashboard,
  Timer,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { saveLastMode } from '../utils/lastMode';

export interface NavItem {
  id: string;
  href: string;
  label: string;
  /** One line shown on the home page cards. */
  description: string;
  icon: LucideIcon;
}

// Every page is a normal link (full page load); the server serves the same app for all paths.
export const HOME_ITEM: NavItem = {
  id: 'home',
  href: '/',
  label: 'Home',
  description: 'Your results at a glance',
  icon: LayoutDashboard,
};

/** The training modes, in the order of the menu. */
export const MODE_ITEMS: NavItem[] = [
  {
    id: 'woodpecker',
    href: '/woodpecker',
    label: 'Woodpecker',
    description: 'Repeat the same endgame puzzles in cycles and get faster every time.',
    icon: Bird,
  },
  {
    id: 'coordinates',
    href: '/coordinates',
    label: 'Coordinates',
    description: 'Click the named square against the clock.',
    icon: Grid3x3,
  },
  {
    id: 'streak',
    href: '/streak',
    label: 'Streak',
    description: 'Puzzles from easy to hard. One wrong move ends the run.',
    icon: Flame,
  },
  {
    id: 'race',
    href: '/race',
    label: 'Race',
    description: 'Solve as many puzzles as you can in 1, 3 or 5 minutes.',
    icon: Timer,
  },
  {
    id: 'blindfold',
    href: '/blindfold',
    label: 'Blindfold',
    description: 'Memorize, then find the mate without seeing the pieces.',
    icon: EyeOff,
  },
];

export const NAV_ITEMS: NavItem[] = [HOME_ITEM, ...MODE_ITEMS];

export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

interface SidebarProps {
  username?: string;
  muted: boolean;
  onToggleMute: () => void;
}

/**
 * The menu. A rounded card on the left of big screens; on small screens it is a card on top of the
 * page with the entries scrolling sideways.
 */
export default function Sidebar({ username, muted, onToggleMute }: SidebarProps) {
  const path = currentPath();

  // The Home page offers "continue where you left off".
  useEffect(() => {
    if (MODE_ITEMS.some((item) => item.href === path)) saveLastMode(path);
  }, [path]);

  return (
    <aside
      className="xl:w-[224px] xl:shrink-0 xl:sticky xl:top-7 xl:self-start bg-[#16233b] border border-white/10 rounded-2xl p-3 flex flex-wrap xl:flex-col items-center xl:items-stretch gap-x-3 gap-y-2 xl:gap-3 shadow-[0_16px_44px_rgba(4,9,20,0.45)]"
    >
      <a
        href="/"
        className="flex items-center gap-2.5 shrink-0 px-1 xl:px-2 xl:py-1.5"
        aria-label="Chess Tactics Guide home"
      >
        <img
          src="/assets/aistudio/Add_a_heading__16_-removebg-preview_c70fa2ca.png"
          alt="Chess Tactics Guide logo"
          className="w-7 h-7 object-contain select-none shrink-0"
          draggable={false}
        />
        <h1 className="text-base font-bold tracking-tight text-white whitespace-nowrap leading-tight">
          Chess Tactics Guide
        </h1>
      </a>

      <div className="ml-auto xl:ml-0 xl:order-3 flex items-center gap-2 min-w-0 xl:border-t xl:border-white/10 xl:pt-3 xl:justify-between">
        {username && (
          <span className="hidden sm:inline text-xs sm:text-sm font-semibold text-white/85 truncate max-w-[150px] xl:max-w-[130px]">
            Welcome, {username}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleMute}
          className="p-2 rounded-xl text-white/85 hover:text-[#39ff88] hover:bg-[#101b2f] border border-transparent hover:border-white/15 transition-all duration-150 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      <nav
        aria-label="Training modes"
        className="w-full xl:order-2 flex xl:flex-col gap-1 overflow-x-auto xl:overflow-visible"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.href === path;
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                active
                  ? 'bg-[#39ff88]/12 border-[#39ff88]/40 text-white'
                  : 'border-transparent text-white/75 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-[#39ff88]' : ''}`} aria-hidden="true" />
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
