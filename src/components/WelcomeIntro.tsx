// What Home shows instead of empty statistics: to a visitor who has not trained yet (a first visit, or after signing
// out, when this browser holds no results) it says what the site is and where to begin.
import type { ReactNode } from 'react';
import { ArrowRight, Check, Crown } from 'lucide-react';
import { NAV_ITEMS } from './Sidebar';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

interface Feature {
  href: string;
  text: string;
}

const FEATURES: Feature[] = [
  { href: '/woodpecker', text: 'Solve the same set of puzzles again and again, faster with every cycle, until the patterns are automatic.' },
  { href: '/streak', text: 'Puzzles that get harder one by one. How long can your streak get before the first mistake?' },
  { href: '/survival', text: 'Three lives, no clock. Climb the ladder of puzzles and see how far you get.' },
  { href: '/coordinates', text: 'Find the named square as fast as you can, until the board is second nature.' },
  { href: '/blindfold', text: 'Mate puzzles without seeing the pieces, square-color and knight-route drills, and rebuilding positions from memory.' },
  { href: '/endgames', text: 'Short lessons on the endgames every player should know, each with a position to try.' },
  { href: '/openings', text: 'The main ideas of the most common openings, explained in plain words.' },
  { href: '/analysis', text: 'Set up any position on the board editor and check it with the engine.' },
  { href: '/ebooks', text: 'Chess books you can download as PDF, from checkmate patterns to a full Caro-Kann repertoire.' },
];

const STEPS: Array<{ title: string; text: string }> = [
  { title: 'Pick a mode', text: 'Start with Woodpecker or Puzzle Streak. Every mode starts easy.' },
  { title: 'Train a little every day', text: 'Set a daily goal and watch your streak of days grow.' },
  { title: 'See your progress', text: 'Statistics, charts and personal bests appear here as soon as you finish your first run.' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

export default function WelcomeIntro({ signedIn }: { signedIn: boolean }) {
  const items = FEATURES.flatMap((feature) => {
    const item = NAV_ITEMS.find((n) => n.href === feature.href);
    return item ? [{ ...feature, item }] : [];
  });
  return (
    <div className="flex flex-col gap-8" data-testid="welcome">
      <section className={`${CARD} p-6 sm:p-8 flex flex-col gap-4`}>
        <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">Train your chess, one puzzle at a time</h2>
        <p className="max-w-[62ch] text-base font-medium text-white/80 leading-relaxed">
          Chess Tactics Guide is a free training site for tactics and endgames. Solve puzzles from the Lichess database,
          drill the board until you know it by heart, learn the key endgames and openings, and keep track of how you improve.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <a href="/woodpecker" data-testid="welcome-start" className={`${PRIMARY_BUTTON_CLASS} sm:w-auto px-6 flex items-center justify-center gap-2 no-underline`}>
            Start training <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          {!signedIn && (
            <a
              href="/login?next=%2F"
              data-testid="welcome-signup"
              className={`${SECONDARY_BUTTON_CLASS} sm:w-auto px-6 flex items-center justify-center no-underline`}
            >
              Create a free account
            </a>
          )}
        </div>
        <p className="text-sm font-medium text-white/60">
          No account is needed to try it. With a free account, your results follow you to every device.
        </p>
      </section>

      <Section title="What you can do here">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="welcome-features">
          {items.map(({ href, text, item }) => {
            const Icon = item.icon;
            return (
              <a
                key={href}
                href={href}
                className={`${CARD} px-5 py-4 flex gap-3.5 no-underline transition-colors hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#39ff88]`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.chipClass}`}>
                  <Icon className={`w-5 h-5 ${item.iconClass}`} aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-white">{item.label}</span>
                  <span className="text-sm font-medium text-white/70 leading-snug">{text}</span>
                </span>
              </a>
            );
          })}
        </div>
      </Section>

      <Section title="How it works">
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className={`${CARD} px-5 py-4 flex flex-col gap-1.5`}>
              <span className="w-7 h-7 rounded-full bg-[#39ff88]/15 text-[#39ff88] text-sm font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-[15px] font-bold text-white">{step.title}</span>
              <span className="text-sm font-medium text-white/70 leading-snug">{step.text}</span>
            </li>
          ))}
        </ol>
      </Section>

      <section className={`${CARD} border-amber-300/30 px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between`} data-testid="welcome-premium">
        <div className="flex gap-3">
          <Crown className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-[15px] font-bold text-white">Free to train, Premium to go further</h3>
            <ul className="mt-1 text-sm font-medium text-white/70 leading-snug flex flex-col gap-0.5">
              {['Every Woodpecker set and every blindfold level', 'All e-books to download'].map((line) => (
                <li key={line} className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" /> {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <a href="/pricing" className={`${SECONDARY_BUTTON_CLASS} sm:w-auto px-5 flex items-center justify-center no-underline shrink-0`}>
          See pricing
        </a>
      </section>
    </div>
  );
}
