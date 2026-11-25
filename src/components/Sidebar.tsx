import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Library,
  ChartColumn,
  ChevronDown,
  Crosshair,
  Cpu,
  EyeOff,
  Flame,
  House,
  LogIn,
  LogOut,
  PencilLine,
  Repeat,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth';
import { signOutAndSync } from '../sync';
import SoundMenu from './SoundMenu';
import SiteLinks from './SiteLinks';

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Colour of the icon. Every entry has its own. */
  iconClass: string;
  /** Soft background behind the icon. */
  chipClass: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Every page is a normal link (full page load); the server serves the same app for all paths.
export const HOME_ITEM: NavItem = {
  id: 'home',
  href: '/',
  label: 'Home',
  icon: House,
  iconClass: 'text-[#39ff88]',
  chipClass: 'bg-[#39ff88]/15',
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'puzzles',
    label: 'Puzzles',
    items: [
      {
        id: 'woodpecker',
        href: '/woodpecker',
        label: 'Woodpecker Method',
        icon: Repeat,
        iconClass: 'text-amber-300',
        chipClass: 'bg-amber-400/15',
      },
      {
        id: 'streak',
        href: '/streak',
        label: 'Puzzle Streak',
        icon: Flame,
        iconClass: 'text-orange-400',
        chipClass: 'bg-orange-500/15',
      },
      {
        id: 'race',
        href: '/race',
        label: 'Puzzle Race',
        icon: Timer,
        iconClass: 'text-sky-400',
        chipClass: 'bg-sky-500/15',
      },
    ],
  },
  {
    id: 'training',
    label: 'Training',
    items: [
      {
        id: 'coordinates',
        href: '/coordinates',
        label: 'Coordinate Training',
        icon: Crosshair,
        iconClass: 'text-violet-400',
        chipClass: 'bg-violet-500/15',
      },
      {
        id: 'blindfold',
        href: '/blindfold',
        label: 'Blindfold Training',
        icon: EyeOff,
        iconClass: 'text-pink-400',
        chipClass: 'bg-pink-500/15',
      },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      {
        id: 'editor',
        href: '/editor',
        label: 'Board Editor',
        icon: PencilLine,
        iconClass: 'text-lime-300',
        chipClass: 'bg-lime-400/15',
      },
      {
        id: 'analysis',
        href: '/analysis',
        label: 'Board Analysis',
        icon: Cpu,
        iconClass: 'text-cyan-300',
        chipClass: 'bg-cyan-400/15',
      },
      {
        id: 'theory',
        href: '/endgames',
        label: 'Endgame Theory',
        icon: BookOpen,
        iconClass: 'text-yellow-300',
        chipClass: 'bg-yellow-400/15',
      },
      {
        id: 'openings',
        href: '/openings',
        label: 'Opening Theory',
        icon: Library,
        iconClass: 'text-orange-300',
        chipClass: 'bg-orange-400/15',
      },
    ],
  },
  {
    id: 'progress',
    label: 'Progress',
    items: [
      {
        id: 'statistics',
        href: '/statistics',
        label: 'Statistics',
        icon: ChartColumn,
        iconClass: 'text-emerald-400',
        chipClass: 'bg-emerald-500/15',
      },
    ],
  },
];

/** The training modes (puzzles and training, not Tools, Home or Statistics), in menu order. */
export const MODE_ITEMS: NavItem[] = NAV_GROUPS.filter((g) => g.id === 'puzzles' || g.id === 'training').flatMap((g) => g.items);

export const NAV_ITEMS: NavItem[] = [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items)];

export const COLLAPSED_STORAGE_KEY = 'ctg_sidebar_collapsed_v1';

/** The theory entries stay marked on every lesson (/endgames/<name>, /openings/<name>). */
function isActive(item: NavItem, path: string): boolean {
  return (
    item.href === path ||
    (item.id === 'theory' && path.startsWith('/endgames/')) ||
    (item.id === 'openings' && path.startsWith('/openings/'))
  );
}

export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function loadCollapsed(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLAPSED_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveCollapsed(ids: string[]): void {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors
  }
}

function NavLink({ item, active, hideOnPhone }: { item: NavItem; active: boolean; hideOnPhone?: boolean }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 px-3 py-1.5 xl:py-1 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
        hideOnPhone ? 'max-sm:hidden' : ''
      } ${
        active
          ? 'bg-[#39ff88]/12 border-[#39ff88]/40 text-white'
          : 'border-transparent text-white/80 hover:text-white hover:bg-white/5'
      }`}
    >
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.chipClass}`}>
        <Icon className={`w-[17px] h-[17px] ${item.iconClass}`} aria-hidden="true" />
      </span>
      {item.label}
    </a>
  );
}

/** Sign in for a guest; the account link and sign out for someone signed in. */
function AccountControls({ compact }: { compact?: boolean }) {
  const { session } = useAuth();
  const button =
    'rounded-xl text-white/85 hover:text-[#39ff88] hover:bg-[#16233b] border border-transparent hover:border-white/15 cursor-pointer flex items-center justify-center shrink-0 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#39ff88]';
  if (!session) {
    return (
      <a
        href="/login"
        data-testid="sign-in-link"
        className={`${button} gap-1.5 min-h-[40px] ${compact ? 'min-w-[40px]' : 'px-3 border-white/15'}`}
        aria-label="Sign in"
        title="Sign in or create an account"
      >
        <LogIn className="w-4 h-4" aria-hidden="true" />
        {!compact && 'Sign in'}
      </a>
    );
  }
  return (
    <button
      type="button"
      data-testid="sign-out-button"
      onClick={() => void signOutAndSync().then(() => window.location.assign('/'))}
      className={`${button} min-h-[40px] min-w-[40px]`}
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}

interface SidebarProps {
  username?: string;
}

/**
 * The menu: a full-height panel on the left of big screens, with collapsible groups. On smaller
 * screens it is a bar on top of the page and the entries scroll sideways in one row.
 */
export default function Sidebar({ username: savedName }: SidebarProps) {
  const path = currentPath();
  const { session, name: accountName } = useAuth();
  // Someone signed in is greeted by the account name; a guest by the name saved in this browser.
  const username = session ? accountName : savedName;
  const [collapsed, setCollapsed] = useState<string[]>(() => loadCollapsed());

  useEffect(() => {
    saveCollapsed(collapsed);
  }, [collapsed]);

  // On a phone the entries scroll sideways: bring the current one to the middle, so after opening a page
  // the menu does not jump back to the start.
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const center = () => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
      const navBox = nav.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      nav.scrollLeft += box.left + box.width / 2 - (navBox.left + navBox.width / 2);
    };
    center();
    // The font arrives after the first paint and changes the widths.
    void document.fonts?.ready.then(center);
  }, []);

  const toggle = (id: string) =>
    setCollapsed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <aside className="xl:w-[256px] xl:shrink-0 xl:sticky xl:top-0 xl:h-screen xl:flex xl:flex-col bg-[#0d1627] border-b xl:border-b-0 xl:border-r border-white/10">
      <div className="flex flex-wrap xl:flex-col items-center xl:items-stretch gap-x-3 gap-y-2 px-4 pt-3 xl:pt-0 xl:flex-1 xl:min-h-0">
        <a
          href="/"
          className="flex items-center gap-3 shrink-0 xl:py-4 xl:border-b xl:border-white/10"
          aria-label="Chess Tactics Guide home"
        >
          <img
            src="/assets/aistudio/Add_a_heading__16_-removebg-preview_c70fa2ca.png"
            alt="Chess Tactics Guide logo"
            className="w-8 h-8 object-contain select-none shrink-0"
            draggable={false}
          />
          <span className="flex flex-col leading-tight">
            <h1 className="text-base font-bold tracking-tight text-white whitespace-nowrap">Chess Tactics Guide</h1>
            <span className="text-xs font-medium text-white/60">Improve Every Day</span>
          </span>
        </a>

        <div className="ml-auto xl:hidden flex items-center gap-2 min-w-0">
          {username && (
            <span className="hidden sm:inline text-xs sm:text-sm font-semibold text-[#39ff88] truncate max-w-[150px]" title={username}>
              {username}
            </span>
          )}
          <AccountControls compact />
          <SoundMenu />
        </div>

        <nav
          ref={navRef}
          aria-label="Training modes"
          className="w-full xl:flex-1 xl:min-h-0 flex xl:flex-col gap-1 overflow-x-auto xl:overflow-x-visible xl:overflow-y-auto pb-3 xl:py-2"
        >
          <NavLink item={HOME_ITEM} active={HOME_ITEM.href === path} />
          {NAV_GROUPS.map((group) => {
            const hasActive = group.items.some((item) => isActive(item, path));
            // The group of the current page stays open, so the current entry is never hidden.
            const open = hasActive || !collapsed.includes(group.id);
            return (
              <div key={group.id} className="contents xl:flex xl:flex-col xl:gap-1 xl:mt-2">
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  aria-expanded={open}
                  aria-controls={`nav-group-${group.id}`}
                  className="hidden xl:flex items-center justify-between px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/50 hover:text-white/80 cursor-pointer"
                >
                  {group.label}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
                    aria-hidden="true"
                  />
                </button>
                <div id={`nav-group-${group.id}`} className={`contents xl:flex xl:flex-col xl:gap-1 ${open ? '' : 'xl:hidden'}`}>
                  {group.items.map((item) => (
                    <NavLink key={item.id} item={item} active={isActive(item, path)} hideOnPhone={group.id === 'tools' && item.id !== 'theory' && item.id !== 'openings'} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="hidden xl:flex items-center justify-between gap-2 px-4 py-2.5 border-t border-white/10">
        <a
          href="/login"
          data-testid="sidebar-name"
          title={username ? `${username}: ${session ? 'your account' : 'sign in or create an account'}` : 'Sign in or create an account'}
          className="min-w-0 flex-1 text-sm font-semibold text-[#39ff88] truncate no-underline hover:text-white"
        >
          {username || 'Guest'}
        </a>
        <AccountControls />
        <SoundMenu />
      </div>
      <SiteLinks className="hidden xl:flex flex-nowrap pb-1 -mt-1" />
    </aside>
  );
}
