import type { ReactNode } from 'react';
import AccessGate, { useGateOpen } from './AccessGate';
import CookieBanner from './CookieBanner';
import SiteLinks from './SiteLinks';
import Sidebar, { AccountControls } from './Sidebar';
import ProfileMenu from './ProfileMenu';
import SoundMenu from './SoundMenu';

interface AppShellProps {
  username?: string;
  /** A heading for the top of the page; on big screens it shares the row with the account buttons. */
  heading?: ReactNode;
  /** Leave out the row of account buttons on big screens (Home for a guest). */
  hideAccountBar?: boolean;
  children: ReactNode;
}

/**
 * Frame of every page: the menu panel on the left (a bar on top on small screens) and the page
 * content next to it. Home, Statistics and all training modes use it, so the menu never moves.
 */
export default function AppShell({ username, heading, hideAccountBar = false, children }: AppShellProps) {
  const gateOpen = useGateOpen();
  return (
    <div className="min-h-screen app-bg text-white xl:flex">
      <Sidebar username={username} />
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 xl:py-7">
        {/* On big screens the account buttons sit at the top right of the page (on small screens they are in the top bar). */}
        <div className={`${hideAccountBar && !heading ? 'hidden' : 'hidden xl:flex'} items-center justify-between gap-4 ${heading ? 'mb-6' : 'mb-2'} min-h-10`} data-testid="topright">
          <div className="min-w-0">{heading}</div>
          <div className="flex items-center gap-1 shrink-0">
            <ProfileMenu guestName={username} align="right" />
            <AccountControls compact />
            <SoundMenu />
          </div>
        </div>
        {heading && <div className="xl:hidden mb-6">{heading}</div>}
        {children}
        <SiteLinks className="flex mt-10 pt-3 border-t border-white/10" />
      </main>
      <AccessGate />
      <CookieBanner hidden={gateOpen} />
    </div>
  );
}
