import type { ReactNode } from 'react';
import AccessGate, { useGateOpen } from './AccessGate';
import CookieBanner from './CookieBanner';
import SiteLinks from './SiteLinks';
import Sidebar from './Sidebar';

interface AppShellProps {
  username?: string;
  children: ReactNode;
}

/**
 * Frame of every page: the menu panel on the left (a bar on top on small screens) and the page
 * content next to it. Home, Statistics and all training modes use it, so the menu never moves.
 */
export default function AppShell({ username, children }: AppShellProps) {
  const gateOpen = useGateOpen();
  return (
    <div className="min-h-screen bg-[#101b2f] text-white xl:flex">
      <Sidebar username={username} />
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 xl:py-7">
        {children}
        <SiteLinks className="flex mt-8 xl:hidden" />
      </main>
      <AccessGate />
      <CookieBanner hidden={gateOpen} />
    </div>
  );
}
