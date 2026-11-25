// What Home shows instead of empty statistics: to a visitor who has not trained yet (a first visit, or after signing
// out, when this browser holds no results) it says what the site is and where to begin.
import type { ReactNode } from 'react';
import { ArrowRight, Check, Crown } from 'lucide-react';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

const STEPS: Array<{ title: string; text: string; image: string; alt: string }> = [
  {
    title: 'Pick a mode',
    text: 'Start with Woodpecker or Puzzle Streak. Every mode starts easy.',
    image: '/welcome/pick-a-mode.webp',
    alt: 'The Puzzle Streak page: the board on the left and the start panel on the right',
  },
  {
    title: 'Train a little every day',
    text: 'Set a daily goal and watch your streak of days grow.',
    image: '/welcome/daily-goal.webp',
    alt: 'The Dashboard with the daily goal bar and the training overview',
  },
  {
    title: 'See your progress',
    text: 'Statistics, charts and personal bests appear here as soon as you finish your first run.',
    image: '/welcome/progress.webp',
    alt: 'Charts of sessions, training time, puzzles solved and accuracy per day',
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

export default function WelcomeIntro({ signedIn, premium }: { signedIn: boolean; premium: boolean }) {
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
        {!signedIn && (
          <p className="text-sm font-medium text-white/60">
            No account is needed to try it. With a free account, your results follow you to every device.
          </p>
        )}
      </section>

      <Section title="How it works">
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className={`${CARD} overflow-hidden flex flex-col`}>
              <div className="px-5 pt-4 pb-3 flex flex-col gap-1.5">
                <span className="w-7 h-7 rounded-full bg-[#39ff88]/15 text-[#39ff88] text-sm font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-[15px] font-bold text-white">{step.title}</span>
                <span className="text-sm font-medium text-white/70 leading-snug">{step.text}</span>
              </div>
              <img
                src={step.image}
                alt={step.alt}
                width={1000}
                height={600}
                loading="lazy"
                className="mt-auto w-full h-auto border-t border-white/10"
              />
            </li>
          ))}
        </ol>
      </Section>

      {!premium && (
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
      )}
    </div>
  );
}
