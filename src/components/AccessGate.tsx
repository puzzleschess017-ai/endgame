import { useEffect, useRef } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import { chooseGuest, useGuestChoice } from '../auth/guest';
import { isInfoPath, WELCOME_WINDOW } from '../site';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';

/** True while the welcome window is covering the page (never, while `WELCOME_WINDOW` in src/site.ts is off). The login page and the About/Privacy/Contact pages are never covered. */
export function useGateOpen(): boolean {
  const { session } = useAuth();
  const chosenGuest = useGuestChoice();
  const path = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : '';
  return WELCOME_WINDOW && !session && !chosenGuest && path !== '/login' && !isInfoPath(path);
}

/**
 * Shown over every page (blurred) to a visitor who has neither signed in nor chosen "Play as a guest",
 * so nobody starts training without knowing an account exists. The login page itself is never covered.
 */
export default function AccessGate() {
  const firstButton = useRef<HTMLAnchorElement | null>(null);
  const open = useGateOpen();

  useEffect(() => {
    if (open) firstButton.current?.focus();
  }, [open]);

  if (!open) return null;
  const next = encodeURIComponent(window.location.pathname || '/');
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      data-testid="gate"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0b1424]/70 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-[440px] bg-[#16233b] border border-white/10 rounded-2xl p-6 sm:p-7 flex flex-col gap-5 shadow-[0_16px_44px_rgba(4,9,20,0.6)]">
        <div>
          <h2 id="gate-title" className="text-2xl font-bold text-white tracking-tight">
            Welcome to Chess Tactics Guide
          </h2>
          <p className="mt-2 text-sm font-medium text-white/80 leading-relaxed">
            Create a free account to keep your results on every device and unlock more training options, or just
            have a look around as a guest.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <a
            ref={firstButton}
            href={`/login?tab=signup&next=${next}`}
            data-testid="gate-create"
            className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center gap-2 no-underline`}
          >
            <UserPlus className="w-5 h-5" aria-hidden="true" /> Create a free account
          </a>
          <a
            href={`/login?next=${next}`}
            data-testid="gate-sign-in"
            className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-2 no-underline`}
          >
            <LogIn className="w-4 h-4" aria-hidden="true" /> I already have an account
          </a>
          <button
            type="button"
            data-testid="gate-guest"
            onClick={chooseGuest}
            className="mt-1 py-2 text-sm font-semibold text-white/70 hover:text-white underline underline-offset-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#39ff88]"
          >
            Play as a guest
          </button>
        </div>
        <p className="text-xs font-medium text-white/55 leading-relaxed">
          Guests can use Woodpecker (Classic puzzles, easy and medium), Puzzle Streak, Puzzle Survival, Coordinate
          Training, the Board Editor and Board Analysis. Results stay in this browser.
        </p>
      </div>
    </div>
  );
}
