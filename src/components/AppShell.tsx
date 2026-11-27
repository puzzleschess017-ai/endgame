import type { ReactNode } from 'react';
import AccessGate, { useGateOpen } from './AccessGate';
import CookieBanner from './CookieBanner';
import SiteLinks from './SiteLinks';
import TopNav from './TopNav';

interface AppShellProps {
  username?: string;
  children: ReactNode;
}

/**
 * Frame of every page: the menu bar on top (logo, the menus, the account buttons) and the page content under it.
 * Home, Statistics and all training modes use it, so the menu never moves.
 */
export default function AppShell({ username, children }: AppShellProps) {
  const gateOpen = useGateOpen();
  return (
    <div className="min-h-screen app-bg text-white">
      <TopNav username={username} />
      <main className="mx-auto w-full max-w-[1760px] min-w-0 px-4 sm:px-6 py-5 xl:py-7">
        {children}
        <SiteLinks className="flex mt-10 pt-3 border-t border-white/10" />
      </main>
      <AccessGate />
      <CookieBanner hidden={gateOpen} />
    </div>
  );
}
