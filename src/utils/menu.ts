// The entries of the menu bar (see src/components/TopNav.tsx): the groups, the icons and colours, and which entry is the
// current page. Plain data and small functions, no React, so they are tested without a browser.
import { BookMarked, BookOpen, Library, Crown, Crosshair, Cpu, EyeOff, Flame, Heart, House, LayoutDashboard, PencilLine, Repeat, Swords, type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Colour of the icon. Every entry has its own. */
  iconClass: string;
  /** Soft background behind the icon. */
  chipClass: string;
  /** One short line under the name in the drop-down menu of big screens. */
  blurb?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Every page is a normal link (the app changes the page itself, see src/utils/navigation.ts); the server serves the same app for all paths.
export const HOME_ITEM: NavItem = {
  id: 'home',
  href: '/',
  label: 'Home',
  icon: House,
  iconClass: 'text-[#39ff88]',
  chipClass: 'bg-[#39ff88]/15',
};

/** The same page is "Home" for a guest and the "Dashboard" of someone signed in. */
export const DASHBOARD_ITEM: NavItem = { ...HOME_ITEM, label: 'Dashboard', icon: LayoutDashboard };

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
        blurb: 'Repeat the same set of puzzles, faster every cycle',
      },
      {
        id: 'streak',
        href: '/streak',
        label: 'Puzzle Streak',
        icon: Flame,
        iconClass: 'text-orange-400',
        chipClass: 'bg-orange-500/15',
        blurb: 'Puzzles get harder; one wrong move ends the run',
      },
      {
        id: 'survival',
        href: '/survival',
        label: 'Puzzle Survival',
        icon: Heart,
        iconClass: 'text-rose-400',
        chipClass: 'bg-rose-500/15',
        blurb: 'Puzzles get harder; you have 3 lives and no clock',
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
        blurb: 'Click the named square as fast as you can',
      },
      {
        id: 'blindfold',
        href: '/blindfold',
        label: 'Blindfold Training',
        icon: EyeOff,
        iconClass: 'text-pink-400',
        chipClass: 'bg-pink-500/15',
        blurb: 'Memorize the position, then find the checkmate',
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
        blurb: 'Set up any position and copy the FEN',
      },
      {
        id: 'analysis',
        href: '/analysis',
        label: 'Board Analysis',
        icon: Cpu,
        iconClass: 'text-cyan-300',
        chipClass: 'bg-cyan-400/15',
        blurb: 'Play on the board and check it with Stockfish',
      },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    items: [
      {
        id: 'theory',
        href: '/endgames',
        label: 'Endgame Theory',
        icon: BookOpen,
        iconClass: 'text-yellow-300',
        chipClass: 'bg-yellow-400/15',
        blurb: 'Endgame lessons with positions to try',
      },
      {
        id: 'openings',
        href: '/openings',
        label: 'Opening Theory',
        icon: Library,
        iconClass: 'text-orange-300',
        chipClass: 'bg-orange-400/15',
        blurb: 'Opening lessons with positions to try',
      },
      {
        id: 'tactics',
        href: '/tactics',
        label: 'Tactics Theory',
        icon: Swords,
        iconClass: 'text-emerald-300',
        chipClass: 'bg-emerald-400/15',
        blurb: 'Forks, pins, mating patterns and more',
      },
      {
        id: 'ebooks',
        href: '/ebooks',
        label: 'eBooks',
        icon: BookMarked,
        iconClass: 'text-rose-300',
        chipClass: 'bg-rose-400/15',
        blurb: 'Free to download with Premium',
      },
    ],
  },
  {
    id: 'premium',
    label: 'Premium',
    items: [
      {
        id: 'pricing',
        href: '/pricing',
        label: 'Pricing',
        icon: Crown,
        iconClass: 'text-amber-300',
        chipClass: 'bg-amber-400/15',
      },
    ],
  },
];

/** The training modes (puzzles and training, not Tools or Home), in menu order. */
export const MODE_ITEMS: NavItem[] = NAV_GROUPS.filter((g) => g.id === 'puzzles' || g.id === 'training').flatMap((g) => g.items);

export const NAV_ITEMS: NavItem[] = [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items)];

/** The theory entries stay marked on every lesson (/endgames/<name>, /openings/<name>, /tactics/<name>). */
export function isActive(item: NavItem, path: string): boolean {
  return (
    item.href === path ||
    (item.id === 'theory' && path.startsWith('/endgames/')) ||
    (item.id === 'openings' && path.startsWith('/openings/')) ||
    (item.id === 'tactics' && path.startsWith('/tactics/'))
  );
}

export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

