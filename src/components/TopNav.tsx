import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../auth';
import ProfileMenu from './ProfileMenu';
import { signOutAndSync } from '../sync';
import SoundMenu from './SoundMenu';
import { currentPath, DASHBOARD_ITEM, HOME_ITEM, isActive, NAV_GROUPS, type NavItem } from '../utils/menu';

/**
 * One page link. On small screens it is a pill in the scrolling row. On big screens it is either a row of a drop-down
 * menu (icon, name and a line about the page) or, with `bar`, a link of the top bar itself: "plain" is text only (Home),
 * "accent" is the amber pill of Pricing.
 */
function NavLink({ item, active, hideOnPhone, bar, onNavigate }: { item: NavItem; active: boolean; hideOnPhone?: boolean; bar?: 'plain' | 'accent'; onNavigate?: () => void }) {
  const Icon = item.icon;
  const tone = active
    ? 'bg-[#39ff88]/12 border-[#39ff88]/40 text-white'
    : bar === 'accent'
      ? 'border-transparent text-white/80 hover:text-white hover:bg-white/5 xl:border-amber-300/40 xl:bg-amber-300/10 xl:text-amber-100 xl:hover:bg-amber-300/20'
      : 'border-transparent text-white/80 hover:text-white hover:bg-white/5';
  const size = bar ? 'xl:gap-2 xl:py-2' : 'xl:items-start xl:py-2';
  return (
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#39ff88] ${size} ${
        hideOnPhone ? 'max-sm:hidden' : ''
      } ${tone}`}
    >
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.chipClass} ${
          bar === 'plain' ? 'xl:hidden' : bar === 'accent' ? 'xl:w-auto xl:h-auto xl:bg-transparent' : ''
        }`}
      >
        <Icon className={`w-[17px] h-[17px] ${item.iconClass}`} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        {item.label}
        {item.blurb && !bar && <span className="hidden xl:block mt-0.5 text-xs font-medium text-white/55 whitespace-normal">{item.blurb}</span>}
      </span>
    </a>
  );
}

/**
 * The sign-out button of someone signed in. A guest gets nothing here: the person icon next to it already goes
 * to the sign-in page, so a second Login button beside it only repeated it.
 */
export function AccountControls() {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <button
      type="button"
      data-testid="sign-out-button"
      onClick={() => void signOutAndSync().then(() => window.location.assign('/'))}
      className="rounded-xl text-white/85 hover:text-[#39ff88] hover:bg-[#16233b] border border-transparent hover:border-white/15 cursor-pointer flex items-center justify-center shrink-0 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#39ff88] min-h-[40px] min-w-[40px]"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}

interface TopNavProps {
  username?: string;
}

/**
 * The menu, a bar at the top of every page. On big screens (from 1280 px) it sticks to the top and has the logo, the
 * entries (Home, then Puzzles, Training, Tools and Library as drop-down menus, then Pricing) and the account buttons.
 * Click a name to open its menu; moving the mouse to another name while one is open switches to it; a click elsewhere,
 * Escape, or leaving it with the keyboard closes it. On smaller screens it is the logo and the account buttons with
 * the entries below them in one row that scrolls sideways (the same markup: the menus simply stay open there).
 */
export default function TopNav({ username: savedName }: TopNavProps) {
  const path = currentPath();
  const { session } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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

  // A menu that is open closes with a click outside of it and with Escape (the focus goes back to its name).
  useEffect(() => {
    if (openGroup === null) return;
    const onPointer = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      navRef.current?.querySelector<HTMLElement>(`[data-group-button="${openGroup}"]`)?.focus();
      setOpenGroup(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  const closeWhenLeft = (id: string) => (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenGroup((current) => (current === id ? null : current));
  };

  const home = session ? DASHBOARD_ITEM : HOME_ITEM;
  return (
    <header className="relative z-40 xl:sticky xl:top-0 bg-gradient-to-b from-[#101c33] to-[#0a1424] xl:from-[#0f1b31]/95 xl:to-[#0a1424]/95 xl:backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-[1760px] flex flex-wrap xl:flex-nowrap items-center gap-x-3 gap-y-2 px-4 pt-3 xl:py-2 xl:px-6">
        <a href="/" className="flex items-center gap-3 shrink-0 max-xl:order-1" aria-label="Chess Tactics Guide home">
          <img
            src="/assets/aistudio/chess-tactics-guide-logo.png"
            alt="Chess Tactics Guide logo"
            className="w-14 h-14 xl:w-11 xl:h-11 object-contain select-none shrink-0"
            draggable={false}
          />
          <h1 className="text-lg font-bold tracking-tight text-white whitespace-nowrap leading-tight">Chess Tactics Guide</h1>
        </a>

        <nav
          ref={navRef}
          aria-label="Training modes"
          className="w-full xl:w-auto xl:flex-1 xl:ml-5 flex items-center gap-1 overflow-x-auto xl:overflow-visible pb-3 xl:pb-0 max-xl:order-3"
        >
          <NavLink item={home} active={HOME_ITEM.href === path} bar="plain" />
          {NAV_GROUPS.filter((group) => group.id !== 'premium').map((group) => {
            const hasActive = group.items.some((item) => isActive(item, path));
            const open = openGroup === group.id;
            return (
              <div key={group.id} className="contents xl:block xl:relative" onBlur={closeWhenLeft(group.id)}>
                <button
                  type="button"
                  data-group-button={group.id}
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  onPointerEnter={(e) => {
                    // With a menu open, moving the mouse to another name opens that one (no extra click).
                    if (e.pointerType === 'mouse' && openGroup !== null && !open) setOpenGroup(group.id);
                  }}
                  aria-expanded={open}
                  aria-controls={`nav-group-${group.id}`}
                  className={`hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                    hasActive
                      ? 'bg-[#39ff88]/12 border-[#39ff88]/40 text-white'
                      : open
                        ? 'bg-white/10 border-transparent text-white'
                        : 'border-transparent text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {group.label}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <div
                  id={`nav-group-${group.id}`}
                  className={`contents ${
                    open ? 'xl:flex' : 'xl:hidden'
                  } xl:flex-col xl:gap-0.5 xl:absolute xl:left-0 xl:top-full xl:mt-2 xl:w-[320px] xl:p-2 xl:rounded-2xl xl:bg-[#16233b] xl:border xl:border-white/10 xl:shadow-[0_18px_48px_rgba(4,9,20,0.6)] xl:z-50`}
                >
                  {group.items.map((item) => (
                    <NavLink key={item.id} item={item} active={isActive(item, path)} hideOnPhone={group.id === 'tools'} onNavigate={() => setOpenGroup(null)} />
                  ))}
                </div>
              </div>
            );
          })}
          {NAV_GROUPS.filter((group) => group.id === 'premium').flatMap((group) =>
            group.items.map((item) => <NavLink key={item.id} item={item} active={isActive(item, path)} bar="accent" />),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1 xl:gap-2 min-w-0 shrink-0 max-xl:order-2">
          <ProfileMenu guestName={savedName} align="right" testId="topbar-name" />
          <AccountControls />
          <SoundMenu />
        </div>
      </div>
    </header>
  );
}
