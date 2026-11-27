// Choices a visitor may not use yet: they stay visible with a small lock, and clicking one says
// what to do (sign in, or Premium). The rules themselves live in src/utils/access.ts.
import { useState } from 'react';
import { Crown, Lock, UserPlus } from 'lucide-react';
import { unlockHint, type Tier } from '../utils/access';

export interface LockNotice {
  /** What was clicked, e.g. "4 cycles". */
  what: string;
  /** "Login to unlock" or "Premium". */
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

/** Small lock in the corner of a locked choice (the button must be `relative`). `small` is for the low, dense buttons. */
export function LockMark({ small = false }: { small?: boolean }) {
  return (
    <Lock
      aria-hidden="true"
      className={`absolute text-white/60 ${small ? 'top-0.5 right-0.5 h-2 w-2' : 'top-1 right-1 h-2.5 w-2.5'}`}
    />
  );
}

/** Extra classes of a locked choice. */
export const LOCKED_CLASS = 'relative opacity-55';

function currentPath(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

/** "Login" link that comes back to the current page afterwards. */
function signInHref(): string {
  return `/login?next=${encodeURIComponent(currentPath())}`;
}

/** "Create an account" link (the sign-up tab) that comes back to the current page afterwards. */
function signUpHref(): string {
  return `/login?tab=signup&next=${encodeURIComponent(currentPath())}`;
}

/** The message under the choices after a click on a locked one. */
export function UnlockNotice({ notice }: { notice: LockNotice | null }) {
  if (!notice) return null;
  const signIn = notice.hint === 'Login to unlock';
  const what = notice.what.charAt(0).toUpperCase() + notice.what.slice(1);
  return (
    <div
      role="status"
      data-testid="unlock-notice"
      className="flex items-start gap-2 text-sm font-medium text-white/90 bg-inset border border-accent/40 rounded-xl px-3.5 py-2.5"
    >
      <Lock aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
      {signIn ? (
        <span>
          {what} is free once you have an account.{' '}
          <a href={signInHref()} data-testid="unlock-sign-in" className="font-bold text-accent underline underline-offset-2">
            Login or create an account
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
 * The links under the settings of Woodpecker and Blindfold, so nobody thinks every locked choice needs Premium:
 * a guest is first told that a free account opens some of them, and everybody without Premium gets a
 * "Get Premium" link to the Pricing tab for the rest. A Premium account sees nothing.
 * A guest sees both side by side, to keep the panel short; `accountLink` is false where the page already has its
 * own "create an account" button for guests (Blindfold), and then only the Premium link is shown.
 */
export function UnlockLinks({ tier, accountLink = true }: { tier: Tier; accountLink?: boolean }) {
  if (tier === 'premium') return null;
  const focus = 'focus-visible:outline-2 focus-visible:outline-accent';
  if (tier === 'guest' && accountLink) {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <a
          href={signUpHref()}
          data-testid="create-account-link"
          className={`flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-2 py-1.5 text-accent no-underline hover:bg-accent/15 ${focus}`}
        >
          <UserPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-bold">Free account</span>
            <span className="block text-[11px] font-semibold opacity-80">unlocks more options</span>
          </span>
        </a>
        <a
          href="/pricing"
          data-testid="get-premium-link"
          className={`flex items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-2 py-1.5 text-amber-300 no-underline hover:bg-amber-300/15 ${focus}`}
        >
          <Crown aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-bold">Get Premium</span>
            <span className="block text-[11px] font-semibold opacity-80">unlocks every option</span>
          </span>
        </a>
      </div>
    );
  }
  return (
    <a
      href="/pricing"
      data-testid="get-premium-link"
      className={`flex items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[13px] font-bold text-amber-300 no-underline hover:bg-amber-300/15 ${focus}`}
    >
      <Crown aria-hidden="true" className="h-4 w-4" /> Get Premium: unlock every option
    </a>
  );
}
