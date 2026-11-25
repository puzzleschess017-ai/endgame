// "Get Premium": the monthly and the yearly plan, bought from Dodo's payment page. Premium has every e-book for free and the
// full training options. What the visitor has and whether buying is open comes from the server (GET /api/ebooks).
import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';
import { auth, authHeaders } from '../auth';
import { PREMIUM_MONTHLY_LABEL, PREMIUM_YEARLY_LABEL, yearlySavingPercent, type PremiumPlan } from '../utils/premium';

/** Which plans can be bought right now (null until the server has answered). */
function usePremiumOpen(): { monthly: boolean; yearly: boolean } | null {
  const [open, setOpen] = useState<{ monthly: boolean; yearly: boolean } | null>(null);
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

export default function PremiumCard({ signedIn, returnTo, unlocking }: { signedIn: boolean; returnTo: string; unlocking: boolean }) {
  const open = usePremiumOpen();
  const [busy, setBusy] = useState<PremiumPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (plan: PremiumPlan) => {
    setBusy(plan);
    setError(null);
    const problem = await startPremiumCheckout(plan);
    if (problem) {
      setError(problem);
      setBusy(null);
    }
  };

  const anyOpen = open !== null && (open.monthly || open.yearly);
  return (
    <section
      data-testid="premium-card"
      className="bg-[#16233b] border border-amber-300/30 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)] p-5 sm:p-6 flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-amber-300/15 flex items-center justify-center shrink-0">
          <Crown className="w-6 h-6 text-amber-300" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Get Premium</h2>
          <p className="mt-0.5 text-sm font-medium text-white/80 leading-relaxed">
            Every e-book for free, plus the full Woodpecker and Blindfold training and every drill.
          </p>
        </div>
      </div>

      {unlocking ? (
        <p data-testid="premium-unlocking" role="status" className="text-sm font-bold text-[#39ff88]">
          Payment received. Turning Premium on…
        </p>
      ) : !signedIn ? (
        <a
          href={`/login?next=${encodeURIComponent(returnTo)}`}
          data-testid="premium-signin"
          className={`${SECONDARY_BUTTON_CLASS} sm:w-auto sm:self-start px-5 flex items-center justify-center no-underline`}
        >
          Sign in to get Premium
        </a>
      ) : open === null ? (
        <p className="text-sm font-medium text-white/70">Checking…</p>
      ) : !anyOpen ? (
        <p data-testid="premium-soon" className="text-sm font-medium text-white/70">
          Premium opens soon.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {open.monthly && (
              <button
                type="button"
                data-testid="premium-monthly"
                disabled={busy !== null}
                onClick={() => void buy('monthly')}
                className={`${SECONDARY_BUTTON_CLASS} flex flex-col items-center justify-center gap-0.5 py-3`}
              >
                <span className="text-lg font-bold text-white tabular-nums">{PREMIUM_MONTHLY_LABEL} / month</span>
                <span className="text-xs font-semibold text-white/70">{busy === 'monthly' ? 'Opening the payment page…' : 'Billed monthly'}</span>
              </button>
            )}
            {open.yearly && (
              <button
                type="button"
                data-testid="premium-yearly"
                disabled={busy !== null}
                onClick={() => void buy('yearly')}
                className={`${PRIMARY_BUTTON_CLASS} flex flex-col items-center justify-center gap-0.5 py-3`}
              >
                <span className="text-lg font-bold tabular-nums">{PREMIUM_YEARLY_LABEL} / year</span>
                <span className="text-xs font-bold">{busy === 'yearly' ? 'Opening the payment page…' : `Best value: save ${yearlySavingPercent()}%`}</span>
              </button>
            )}
          </div>
          {error && (
            <p role="alert" data-testid="premium-error" className="text-sm font-medium text-[#ffd2cc]">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
