// The buy button of one Premium plan (monthly or yearly), bought from Dodo's payment page. What can be bought comes from
// the server (GET /api/ebooks), which says which of the two products are set up; the Pricing page asks once and hands
// the answer to both cards.
import { useEffect, useState } from 'react';
import { LOGIN_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';
import { auth, authHeaders } from '../auth';
import { PREMIUM_MONTHLY_LABEL, PREMIUM_YEARLY_LABEL, type PremiumPlan } from '../utils/premium';

export type PremiumOpen = { monthly: boolean; yearly: boolean };

/** Which plans can be bought right now (null until the server has answered). */
export function usePremiumOpen(): PremiumOpen | null {
  const [open, setOpen] = useState<PremiumOpen | null>(null);
  useEffect(() => {
    let current = true;
    fetch('/api/ebooks', { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { premium?: { monthly?: unknown; yearly?: unknown } } | null) => {
        if (current) setOpen({ monthly: body?.premium?.monthly === true, yearly: body?.premium?.yearly === true });
      })
      .catch(() => current && setOpen({ monthly: false, yearly: false }));
    return () => {
      current = false;
    };
  }, []);
  return open;
}

/** Asks the server for a checkout of Premium and goes to its page. Returns an error message when that did not work. */
async function startPremiumCheckout(plan: PremiumPlan): Promise<string | null> {
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer: `premium:${plan}` }),
    });
    const body = (await res.json().catch(() => null)) as { url?: unknown; error?: unknown } | null;
    if (res.ok && typeof body?.url === 'string') {
      window.location.assign(body.url);
      return null;
    }
    if (res.status === 409) void auth.refreshPlan(); // the account is already Premium: show it
    return typeof body?.error === 'string' ? body.error : 'The payment page could not be opened. Please try again.';
  } catch {
    return 'The payment page could not be opened. Check your connection and try again.';
  }
}

interface PremiumBuyProps {
  plan: PremiumPlan;
  open: PremiumOpen | null;
  signedIn: boolean;
  returnTo: string;
  /** True while the page waits for the payment to arrive as Premium. */
  unlocking: boolean;
}

export default function PremiumBuy({ plan, open, signedIn, returnTo, unlocking }: PremiumBuyProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buy = async () => {
    setBusy(true);
    setError(null);
    const problem = await startPremiumCheckout(plan);
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  };

  const price = plan === 'monthly' ? PREMIUM_MONTHLY_LABEL : PREMIUM_YEARLY_LABEL;
  const buttonClass = plan === 'yearly' ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS;
  return (
    <div data-testid={`premium-buy-${plan}`} className="flex flex-col gap-2 mt-auto">
      {unlocking ? (
        <p data-testid="premium-unlocking" role="status" className="text-sm font-bold text-accent">
          Payment received. Turning Premium on…
        </p>
      ) : !signedIn ? (
        <a
          href={`/login?next=${encodeURIComponent(returnTo)}`}
          data-testid={`premium-signin-${plan}`}
          className={`${LOGIN_BUTTON_CLASS} flex items-center justify-center no-underline`}
        >
          Login to get Premium
        </a>
      ) : open === null ? (
        <p className="text-sm font-medium text-white/70">Checking…</p>
      ) : !open[plan] ? (
        <p data-testid={`premium-soon-${plan}`} className="text-sm font-medium text-white/70">
          Opens soon.
        </p>
      ) : (
        <>
          <button type="button" data-testid={`premium-${plan}`} disabled={busy} onClick={() => void buy()} className={buttonClass}>
            {busy ? 'Opening the payment page…' : `Get ${plan === 'monthly' ? 'monthly' : 'yearly'} Premium · ${price}`}
          </button>
          {error && (
            <p role="alert" data-testid="premium-error" className="text-sm font-medium text-danger-ink">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
