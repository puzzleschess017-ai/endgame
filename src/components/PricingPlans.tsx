// The three plans as one row of separate cards: Free, Monthly a little bigger and raised, and Yearly the biggest, dark
// with a badge, because it is the plan we want people to pick. The Pricing page puts the buy buttons in it
// and the home page puts links to the Pricing page, so the buttons are handed in.
import type { ReactNode } from 'react';
import { Check, Crown } from 'lucide-react';
import {
  PREMIUM_MONTHLY_CENTS,
  PREMIUM_MONTHLY_LABEL,
  PREMIUM_YEARLY_CENTS,
  PREMIUM_YEARLY_LABEL,
  priceLabel,
  yearlySavingPercent,
} from '../utils/premium';

export type PlanId = 'free' | 'monthly' | 'yearly';

const FREE_POINTS = [
  'Puzzle Streak, Puzzle Survival, Coordinate Training, Board Editor, Statistics and the theory lessons',
  'Woodpecker and Blindfold with the starter options',
  'A free account keeps your results on every device',
];

const PREMIUM_POINTS = [
  'Every Woodpecker set, up to 9 cycles, Expert and Endgame puzzles',
  'Blindfold with every level and every drill',
  'Every e-book to download',
];

/** What Yearly says: everything Monthly has, and why paying once a year is better. */
function yearlyPoints(): string[] {
  const months = Math.round((PREMIUM_MONTHLY_CENTS * 12 - PREMIUM_YEARLY_CENTS) / PREMIUM_MONTHLY_CENTS);
  return [
    'Everything in Monthly: every Woodpecker set, every Blindfold level and drill, every e-book',
    `Save ${priceLabel(PREMIUM_MONTHLY_CENTS * 12 - PREMIUM_YEARLY_CENTS)} a year, about ${months} months free`,
    'One payment a year instead of twelve',
  ];
}

function Points({ items, tick }: { items: string[]; tick: string }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-white/80 leading-snug">
          <span className={`mt-px w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${tick}`}>
            <Check className="w-3 h-3" aria-hidden="true" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PricingPlans({ action }: { action: (plan: PlanId) => ReactNode }) {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.06fr_1.2fr] items-center md:py-6" data-testid="plans">
      <section
        className="rounded-3xl bg-[#16233b] border border-white/10 shadow-[0_16px_44px_rgba(4,9,20,0.45)] p-5 sm:p-6 flex flex-col gap-4"
        data-testid="plan-free"
      >
        <p className="text-4xl font-bold text-white tracking-tight tabular-nums">
          $0 <span className="text-sm font-semibold text-white/55">/ forever</span>
        </p>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Free</h2>
          <p className="mt-1 text-sm font-medium text-white/60 leading-snug">All the training, to try with no account.</p>
        </div>
        <Points items={FREE_POINTS} tick="bg-white/10 text-white/70" />
        <div className="mt-auto pt-2">{action('free')}</div>
      </section>

      <section
        className="rounded-3xl bg-[#1b2c4a] border border-amber-300/30 shadow-[0_20px_54px_rgba(4,9,20,0.55)] p-6 sm:p-7 flex flex-col gap-4 md:py-8"
        data-testid="plan-monthly"
      >
        <p className="text-[2.6rem] leading-none font-bold text-white tracking-tight tabular-nums">
          {PREMIUM_MONTHLY_LABEL} <span className="text-sm font-semibold text-white/55">/ month</span>
        </p>
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
            <Crown className="w-5 h-5 text-amber-300" aria-hidden="true" /> Monthly
          </h2>
          <p className="mt-1 text-sm font-medium text-white/60 leading-snug">Billed every month. Cancel any time.</p>
        </div>
        <Points items={PREMIUM_POINTS} tick="bg-amber-300/15 text-amber-300" />
        <div className="mt-auto pt-2">{action('monthly')}</div>
      </section>

      <section
        className="relative rounded-3xl bg-[#070e1c] border border-[#39ff88]/50 ring-1 ring-[#39ff88]/25 shadow-[0_24px_70px_rgba(57,255,136,0.2),0_16px_44px_rgba(4,9,20,0.6)] p-6 sm:p-8 flex flex-col gap-4 md:py-12 order-first md:order-none"
        data-testid="plan-yearly"
      >
        <span className="self-end rounded-full bg-[#39ff88] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#06210f]">
          Best value · save {yearlySavingPercent()}%
        </span>
        <p className="text-5xl sm:text-6xl leading-none font-bold text-white tracking-tight tabular-nums">
          {PREMIUM_YEARLY_LABEL} <span className="text-sm font-semibold text-white/55">/ year</span>
        </p>
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white tracking-tight">
            <Crown className="w-5 h-5 text-amber-300" aria-hidden="true" /> Yearly
          </h2>
          <p className="mt-1 text-sm font-semibold text-white/70 leading-snug">
            That is {priceLabel(Math.round(PREMIUM_YEARLY_CENTS / 12))} a month. Cancel any time.
          </p>
        </div>
        <Points items={yearlyPoints()} tick="bg-[#39ff88]/20 text-[#39ff88]" />
        <div className="mt-auto pt-2">{action('yearly')}</div>
      </section>
    </div>
  );
}
