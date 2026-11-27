import { useSyncExternalStore, type ReactNode } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import AppShell from './AppShell';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS } from './panelUi';
import { readSavedUsername } from '../utils/profile';

/** Phones are narrower than this (the menu also hides the tools there). */
export const PHONE_QUERY = '(max-width: 639px)';

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/**
 * A tool made for a bigger screen (a board you click squares on, a table of moves). On a phone it is not
 * shown (and not downloaded); whoever arrives by a link gets this note instead.
 */
export default function BigScreenOnly({ title, children }: { title: string; children: ReactNode }) {
  const phone = useIsPhone();
  if (!phone) return <>{children}</>;
  return (
    <AppShell username={readSavedUsername()}>
      <div className="max-w-[460px] mx-auto" data-testid="big-screen-only">
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="w-7 h-7 text-accent shrink-0" aria-hidden="true" />
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          </div>
          <p className="text-sm font-medium text-white/80 leading-relaxed">
            This tool is made for a bigger screen. Open it on a computer or a tablet; on the phone, the training
            modes are all there.
          </p>
          <a href="/" className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center no-underline`}>
            Back to Home
          </a>
        </div>
      </div>
    </AppShell>
  );
}
