// "Your subscription" on the Pricing page, for a person who has Premium: when it renews and a button to cancel it. Cancelling
// stops the next payment; Premium stays until the end of the period that is already paid. The server does the cancelling
// (POST /api/subscription/cancel) and checks that the subscription is this person's own.
import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { SECONDARY_BUTTON_CLASS } from './panelUi';
import { authHeaders } from '../auth';
import { formatLongDate, parseSubscription, subscriptionSentence, type SubscriptionInfo } from '../utils/subscription';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';
const DANGER_BUTTON_CLASS =
  'py-2.5 px-4 rounded-xl bg-[#ff6b5e] hover:bg-[#ff8378] disabled:opacity-60 disabled:cursor-not-allowed text-[#2a0b08] text-sm font-bold cursor-pointer min-h-[42px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b5e]';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; info: SubscriptionInfo };

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : fallback;
}

export default function SubscriptionCard() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetch('/api/subscription', { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res, 'Your subscription could not be loaded.'));
        return parseSubscription(await res.json());
      })
      .then((info) => current && setLoad({ state: 'ready', info }))
      .catch((err: unknown) => current && setLoad({ state: 'error', message: err instanceof Error ? err.message : 'Your subscription could not be loaded.' }));
    return () => {
      current = false;
    };
  }, []);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/subscription/cancel', { method: 'POST', headers: authHeaders() });
      if (!res.ok) {
        setError(await readError(res, 'The subscription could not be cancelled. Please try again.'));
        return;
      }
      setLoad({ state: 'ready', info: parseSubscription(await res.json()) });
      setConfirming(false);
    } catch {
      setError('The subscription could not be cancelled. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const info = load.state === 'ready' ? load.info : null;
  const endDate = info?.nextBillingDate ? formatLongDate(info.nextBillingDate) : 'the end of the period you have paid for';
  return (
    <section data-testid="subscription-card" aria-labelledby="subscription-title" className={`${CARD} p-5 sm:p-6 flex flex-col gap-3`}>
      <h2 id="subscription-title" className="text-lg font-bold text-white flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-amber-300" aria-hidden="true" /> Your subscription
      </h2>

      {load.state === 'loading' && <p className="text-sm font-medium text-white/70">Checking your subscription…</p>}

      {load.state === 'error' && (
        <p role="alert" data-testid="subscription-error" className="text-sm font-medium text-[#ffd2cc] leading-relaxed">
          {load.message} You can also cancel in Dodo’s customer portal (the link is in your receipt e-mail), or write to us on the{' '}
          <a href="/contact" className="underline">
            Contact page
          </a>
          .
        </p>
      )}

      {info && !info.managed && (
        <p data-testid="subscription-none" className="text-sm font-medium text-white/80 leading-relaxed">
          There is no subscription to cancel on this account. If you think you are being charged, write to us on the{' '}
          <a href="/contact" className="underline">
            Contact page
          </a>
          .
        </p>
      )}

      {info?.managed && (
        <>
          <p data-testid="subscription-status" role="status" className={`text-sm font-medium leading-relaxed ${info.cancelScheduled ? 'text-[#39ff88]' : 'text-white/80'}`}>
            {subscriptionSentence(info)}
          </p>
          {!info.cancelScheduled && !confirming && (
            <button type="button" data-testid="subscription-cancel" onClick={() => setConfirming(true)} className={`${SECONDARY_BUTTON_CLASS} sm:w-auto sm:self-start`}>
              Cancel subscription
            </button>
          )}
          {!info.cancelScheduled && confirming && (
            <div data-testid="subscription-confirm" className="flex flex-col gap-3 rounded-xl border border-white/15 bg-[#101b2f] p-4">
              <p className="text-sm font-medium text-white/85 leading-relaxed">
                Cancel your subscription? You will not be charged again, and you keep Premium until {endDate}. After that your account goes back to
                Free; your results and settings stay.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" data-testid="subscription-confirm-yes" disabled={busy} onClick={() => void cancel()} className={DANGER_BUTTON_CLASS}>
                  {busy ? 'Cancelling…' : 'Yes, cancel subscription'}
                </button>
                <button
                  type="button"
                  data-testid="subscription-confirm-no"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    setError(null);
                  }}
                  className={`${SECONDARY_BUTTON_CLASS} sm:w-auto`}
                >
                  Keep Premium
                </button>
              </div>
              {error && (
                <p role="alert" data-testid="subscription-cancel-error" className="text-sm font-medium text-[#ffd2cc]">
                  {error}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
