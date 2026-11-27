// The Pricing tab: what is free, what Premium adds, and the buttons that buy it (payment on Dodo's page).
// After paying, Dodo sends the person back here (?purchase=premium&status=...); the plan arrives a moment later through the
// webhook, so the page asks the account again every few seconds until Premium is there.
import { useEffect, useState } from 'react';
import { Check, Crown, Minus } from 'lucide-react';
import AppShell from '../components/AppShell';
import PremiumBuy, { usePremiumOpen } from '../components/PremiumBuy';
import PricingPlans from '../components/PricingPlans';
import { SECONDARY_BUTTON_CLASS } from '../components/panelUi';
import { auth, useAuth } from '../auth';
import { pricingGroups, type Cell } from '../utils/pricing';
import { readSavedUsername } from '../utils/profile';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Which account gets Premium?',
    a: 'The one you are signed in with when you pay. Sign in first, pay, and Premium shows up on every device where you use that account, usually within seconds.',
  },
  {
    q: 'How do I pay?',
    a: 'On the payment page of Dodo Payments, our payment provider and the seller of Premium. Your card details go to Dodo and never reach this site. Depending on your country, tax is added at checkout.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes, at any time. Cancelling stops the next payment, and you keep Premium until the end of the period you have already paid for. You can manage the subscription in Dodo’s customer portal, or write to us on the Contact page. Your first payment can be refunded within 7 days; see the Refund and Cancellation Policy.',
  },
  {
    q: 'What happens to my results if Premium ends?',
    a: 'Nothing is deleted. Your results, statistics and settings stay on your account; only the Premium options lock again, and the e-books can no longer be downloaded.',
  },
];

function CellView({ value, premium }: { value: Cell; premium?: boolean }) {
  if (value === true) return <Check className={`mx-auto w-4 h-4 ${premium ? 'text-amber-300' : 'text-[#39ff88]'}`} aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto w-4 h-4 text-white/35" aria-label="Not included" />;
  return <span className={premium ? 'font-bold text-white' : 'text-white/85'}>{value}</span>;
}

export default function PricingPage() {
  const { session, tier, name } = useAuth();
  const signedIn = session !== null;
  const isPremium = tier === 'premium';
  const open = usePremiumOpen();

  const [paid] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const status = (params.get('status') ?? '').toLowerCase();
    return params.get('purchase') === 'premium' && (status === '' || ['succeeded', 'active', 'processing'].includes(status));
  });
  const [tries, setTries] = useState(0);
  const waiting = paid && signedIn && !isPremium && tries < 12;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => {
      setTries((n) => n + 1);
      void auth.refreshPlan();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [waiting, tries]);

  useEffect(() => {
    document.title = 'Pricing: Free, Monthly and Yearly | Chess Tactics Guide';
  }, []);

  return (
    <AppShell username={name || readSavedUsername()}>
      <div className="mx-auto w-full max-w-[1000px] flex flex-col gap-5" data-testid="pricing">
        <header className="flex items-start gap-3">
          <span className="w-12 h-12 rounded-xl bg-amber-300/15 flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6 text-amber-300" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Pricing</h1>
            <p className="mt-1 text-[15px] font-medium text-white/75 leading-relaxed">
              Training is free. Premium opens every Woodpecker and Blindfold option and every drill, and the e-books are free to download with it.
            </p>
          </div>
        </header>

        {isPremium && (
          <p
            data-testid="pricing-has-premium"
            className={`${CARD} border-[#39ff88]/40 px-5 py-3 flex items-center gap-2 text-sm font-bold text-[#39ff88]`}
          >
            <Check className="w-4 h-4" aria-hidden="true" /> You have Premium. Thank you!
          </p>
        )}

        <PricingPlans
          action={(plan) =>
            plan === 'free' ? (
              !signedIn ? (
                <a href="/login?tab=signup&next=%2Fpricing" className={`${SECONDARY_BUTTON_CLASS} !min-h-[48px] flex items-center justify-center no-underline`}>
                  Create a free account
                </a>
              ) : null
            ) : !isPremium ? (
              <PremiumBuy plan={plan} open={open} signedIn={signedIn} returnTo="/pricing" unlocking={waiting} />
            ) : null
          }
        />

        <section className={`${CARD} p-3 sm:p-5`} aria-labelledby="compare-title">
          <h2 id="compare-title" className="px-2 pt-1 pb-3 text-xl font-bold text-white tracking-tight">
            Compare
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm" data-testid="pricing-table">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-white/60">
                  <th scope="col" className="text-left px-2 py-2 font-bold">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="px-2 py-2 font-bold">Guest</th>
                  <th scope="col" className="px-2 py-2 font-bold">Free account</th>
                  <th scope="col" className="px-2 py-2 font-bold text-amber-300">Premium</th>
                </tr>
              </thead>
              {pricingGroups().map((group) => (
                <tbody key={group.id}>
                  <tr>
                    <th colSpan={4} scope="colgroup" className="text-left px-2 pt-4 pb-1 text-sm font-bold text-white">
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="border-t border-white/10 text-center">
                      <th scope="row" className="text-left px-2 py-2 font-medium text-white/80">
                        {row.label}
                      </th>
                      <td className="px-2 py-2"><CellView value={row.guest} /></td>
                      <td className="px-2 py-2"><CellView value={row.free} /></td>
                      <td className="px-2 py-2"><CellView value={row.premium} premium /></td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>

        <section className={`${CARD} p-5 sm:p-6 flex flex-col gap-4`} aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-xl font-bold text-white tracking-tight">
            Questions
          </h2>
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3 className="text-sm font-bold text-white">{item.q}</h3>
              <p className="mt-0.5 text-sm font-medium text-white/75 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
