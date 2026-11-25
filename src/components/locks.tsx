// Choices a visitor may not use yet: they stay visible with a small lock, and clicking one says
// what to do (sign in, or Premium). The rules themselves live in src/utils/access.ts.
import { useState } from 'react';
import { Crown, Lock } from 'lucide-react';
import { unlockHint, type Tier } from '../utils/access';

export interface LockNotice {
  /** What was clicked, e.g. "4 cycles". */
  what: string;
  /** "Sign in to unlock" or "Premium". */
  hint: string;
}

/** The lock state of one page: which choices are locked, and the message after clicking one. */
export function useLocks(tier: Tier) {
  const [notice, setNotice] = useState<LockNotice | null>(null);
  return {
    notice,
    /** True when the choice needs a higher plan than the visitor has (`needs` = lowest plan that has it). */
    isLocked: (needs: Tier | null) => unlockHint(tier, needs) !== '',
    /** The click handler of a choice: applies it, or shows why it is locked. */
    choose: (what: string, needs: Tier | null, apply: () => void) => () => {
      const hint = unlockHint(tier, needs);
      if (hint) setNotice({ what, hint });
      else {
        setNotice(null);
        apply();
      }
    },
    clear: () => setNotice(null),
  };
}

/** Small lock in the corner of a locked choice (the button must be `relative`). */
export function LockMark() {
  return <Lock aria-hidden="true" className="absolute top-1 right-1 h-2.5 w-2.5 text-white/60" />;
}

/** Extra classes of a locked choice. */
export const LOCKED_CLASS = 'relative opacity-55';

/** "Sign in" link that comes back to the current page afterwards. */
function signInHref(): string {
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;
  return `/login?next=${encodeURIComponent(path)}`;
}

/** The message under the choices after a click on a locked one. */
export function UnlockNotice({ notice }: { notice: LockNotice | null }) {
  if (!notice) return null;
  const signIn = notice.hint === 'Sign in to unlock';
  const what = notice.what.charAt(0).toUpperCase() + notice.what.slice(1);
  return (
    <div
      role="status"
      data-testid="unlock-notice"
      className="flex items-start gap-2 text-sm font-medium text-white/90 bg-[#101b2f] border border-[#39ff88]/40 rounded-xl px-3.5 py-2.5"
    >
      <Lock aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0 text-[#39ff88]" />
      {signIn ? (
        <span>
          {what} is free once you have an account.{' '}
          <a href={signInHref()} data-testid="unlock-sign-in" className="font-bold text-[#39ff88] underline underline-offset-2">
            Sign in or create an account
          </a>
          .
        </span>
      ) : (
        <span>
          {what} is part of Premium.{' '}
          <a href="/pricing" data-testid="unlock-get-premium" className="font-bold text-amber-300 underline underline-offset-2">
            Get Premium
          </a>
        </span>
      )}
    </div>
  );
}

/**
 * A small "Get Premium" link to the Pricing tab, shown under the settings of Woodpecker and Blindfold to everybody
 * who does not have Premium yet (it is not shown to a Premium account).
 */
export function GetPremiumLink({ tier }: { tier: Tier }) {
  if (tier === 'premium') return null;
  return (
    <a
      href="/pricing"
      data-testid="get-premium-link"
      className="flex items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3.5 py-2 text-sm font-bold text-amber-300 no-underline hover:bg-amber-300/15 focus-visible:outline-2 focus-visible:outline-[#39ff88]"
    >
      <Crown aria-hidden="true" className="h-4 w-4" /> Get Premium: unlock every option
    </a>
  );
}
