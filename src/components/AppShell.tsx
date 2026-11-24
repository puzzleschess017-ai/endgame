import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface AppShellProps {
  username?: string;
  muted: boolean;
  onToggleMute: () => void;
  children: ReactNode;
}

/**
 * Frame of every page: the menu card on the left (on top on small screens) and the page content
 * next to it. Home and all training modes use it, so the menu never moves.
 */
export default function AppShell({ username, muted, onToggleMute, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#101b2f] text-white">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-4 xl:py-7 flex flex-col xl:flex-row gap-4 xl:gap-7">
        <Sidebar username={username} muted={muted} onToggleMute={onToggleMute} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
