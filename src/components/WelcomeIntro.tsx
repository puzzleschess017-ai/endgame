// What Home shows instead of empty statistics: to a visitor who has not trained yet (a first visit, or after signing
// out, when this browser holds no results) it says what the site is, with two phone screenshots, and shows the prices.
import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, EyeOff, LogIn, Repeat } from 'lucide-react';
import { LOGIN_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';
import PricingPlans from './PricingPlans';
import { EBOOKS } from '../utils/ebooks';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

const SHOTS = {
  survival: { src: '/welcome/phone-survival.webp', alt: 'Puzzle Survival on a phone: a puzzle on the board and three lives under it' },
  woodpecker: { src: '/welcome/phone-woodpecker.webp', alt: 'The Woodpecker Method on a phone: a puzzle on the board, with the cycle, the accuracy and the timers under it' },
};

interface Guide {
  id: string;
  title: string;
  icon: typeof Repeat;
  tint: string;
  text: string;
  points: string[];
  links: Array<{ href: string; label: string }>;
  /** Something extra under the text: an example, the steps, the covers. */
  extra: ReactNode;
}

/** The same 50 puzzles, three cycles: the time falls. Only an example, to show the idea. */
const CYCLE_EXAMPLE = [
  { cycle: 1, time: '18:40', seconds: 1120 },
  { cycle: 2, time: '11:20', seconds: 680 },
  { cycle: 3, time: '7:05', seconds: 425 },
].map((row, _i, all) => ({
  ...row,
  width: `${Math.round((row.seconds / all[0].seconds) * 100)}%`,
  faster: row.cycle === 1 ? null : `${Math.round((1 - row.seconds / all[0].seconds) * 100)}% faster`,
}));

const BLINDFOLD_STEPS = [
  { title: 'Memorize', text: 'The position stays for 5 to 20 seconds.' },
  { title: 'The pieces vanish', text: 'Only the empty board is left.' },
  { title: 'Type the move', text: 'For example Qh7#.' },
];

const GUIDES: Guide[] = [
  {
    id: 'woodpecker',
    title: 'The Woodpecker Method',
    icon: Repeat,
    tint: 'bg-amber-300/15 text-amber-300',
    text: 'Solve one fixed set of puzzles, then the same set again, faster each time. Seeing the same positions over and over turns patterns into habit, so you spot them at a glance in your own games.',
    points: ['You choose the number of puzzles and cycles', 'Time and accuracy for every cycle', 'A review of the puzzles you missed'],
    links: [
      { href: '/woodpecker', label: 'Start a Woodpecker set' },
      { href: '/about', label: 'Read more' },
    ],
    extra: (
      <div data-testid="cycle-example">
        <p className="text-xs font-bold uppercase tracking-wider text-white/50">Example: the same 50 puzzles, three cycles</p>
        <ol className="mt-3 flex flex-col gap-3">
          {CYCLE_EXAMPLE.map((row) => (
            <li
              key={row.cycle}
              className="rounded-xl bg-[#101b2f] border border-white/10 px-4 sm:px-5 py-3.5 grid grid-cols-[1fr_auto] sm:grid-cols-[5.5rem_5.5rem_1fr_7.5rem] items-center gap-x-4 gap-y-2"
            >
              <span className="text-sm font-bold text-white/70 sm:order-1">Cycle {row.cycle}</span>
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums justify-self-end sm:justify-self-start sm:order-2">{row.time}</span>
              <span className="col-span-2 sm:col-span-1 order-last sm:order-3 h-2.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-[#39ff88]" style={{ width: row.width }} />
              </span>
              {row.faster ? (
                <span className="hidden sm:block sm:order-4 justify-self-end rounded-full bg-[#39ff88]/15 px-2.5 py-0.5 text-xs font-bold text-[#39ff88]">{row.faster}</span>
              ) : (
                <span className="hidden sm:block sm:order-4 justify-self-end rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/60">First time</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    ),
  },
  {
    id: 'blindfold',
    title: 'Blindfold training',
    icon: EyeOff,
    tint: 'bg-pink-400/15 text-pink-300',
    text: 'Memorize the position, then the pieces vanish and you find the checkmate from memory. Seeing the board in your head is the skill behind calculating long lines, and it can be trained.',
    points: ['Mate in 1, 2 or 3', 'Drills: colours, checks, attacks, knight moves and more', 'Rebuild a position from memory'],
    links: [{ href: '/blindfold', label: 'Try blindfold' }],
    extra: (
      <ol className="grid gap-3 sm:grid-cols-3" data-testid="blindfold-steps">
        {BLINDFOLD_STEPS.map((step, i) => (
          <li key={step.title} className="rounded-xl bg-[#101b2f] border border-white/10 px-4 py-3 flex gap-3">
            <span className="w-7 h-7 rounded-full bg-pink-400/15 text-pink-300 text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span>
              <span className="block text-[15px] font-bold text-white">{step.title}</span>
              <span className="block text-sm font-medium text-white/65 leading-snug">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    id: 'books',
    title: 'Free chess books',
    icon: BookOpen,
    tint: 'bg-fuchsia-300/15 text-fuchsia-300',
    text: 'Seven chess books as PDF files, with diagrams, plans, traps and exercises. They are free to download with Premium, with nothing more to buy.',
    points: ['Openings, endgames, tactics and checkmate patterns', 'Exercises with solutions', 'Yours to keep'],
    links: [
      { href: '/ebooks', label: 'See the books' },
      { href: '/pricing', label: 'See Premium' },
    ],
    extra: (
      <ul className="grid grid-cols-4 sm:grid-cols-7 gap-3" data-testid="book-covers">
        {EBOOKS.map((book) => (
          <li key={book.slug}>
            <a href="/ebooks" title={book.title} className="block">
              <img
                src={`/covers/${book.slug}.webp`}
                alt={book.title}
                width={480}
                height={720}
                loading="lazy"
                className="w-full h-auto rounded-lg border border-white/10 shadow-[0_8px_20px_rgba(4,9,20,0.5)] transition-transform duration-150 hover:-translate-y-1"
              />
            </a>
          </li>
        ))}
      </ul>
    ),
  },
];

/** A phone around a screenshot of the site. */
function Phone({ shot, className = '' }: { shot: { src: string; alt: string }; className?: string }) {
  return (
    <div className={`rounded-[1.9rem] border-[6px] border-[#0b1424] ring-1 ring-white/20 bg-[#0b1424] overflow-hidden shadow-[0_20px_50px_rgba(4,9,20,0.55)] ${className}`}>
      <img src={shot.src} alt={shot.alt} width={780} height={1800} className="w-full h-auto block rounded-[1.4rem]" />
    </div>
  );
}

export default function WelcomeIntro({ signedIn, premium }: { signedIn: boolean; premium: boolean }) {
  return (
    <div className="flex flex-col gap-10" data-testid="welcome">
      <section className={`${CARD} p-6 sm:p-9 grid gap-8 grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.2fr_1fr] items-center`}>
        <div className="flex flex-col gap-4">
          <span className="self-start rounded-full bg-[#39ff88]/10 border border-[#39ff88]/30 px-3 py-1 text-xs font-bold text-[#39ff88]">
            Built on the Woodpecker Method
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-[1.1]">Train your chess, improve every day</h2>
          <p className="max-w-[56ch] text-base sm:text-lg font-medium text-white/80 leading-relaxed">
            Chess Tactics Guide is a free training site for tactics and endgames. Solve puzzles from the Lichess database, drill the
            board until you know it by heart, learn the key endgames and openings, and keep track of how you improve.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-1">
            <a href="/woodpecker" data-testid="welcome-start" className={`${PRIMARY_BUTTON_CLASS} sm:w-auto px-5 flex items-center justify-center gap-2 no-underline`}>
              Start training <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            {!signedIn && (
              <>
                <a
                  href="/login?tab=signup&next=%2F"
                  data-testid="welcome-signup"
                  className={`${SECONDARY_BUTTON_CLASS} sm:w-auto px-4 flex items-center justify-center no-underline transition-all duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0`}
                >
                  Create account
                </a>
                <a
                  href="/login?next=%2F"
                  data-testid="welcome-signin"
                  className={`${LOGIN_BUTTON_CLASS} btn-shine-late sm:!w-auto px-4 flex items-center justify-center gap-2 no-underline`}
                >
                  <LogIn className="w-4 h-4" aria-hidden="true" /> Login
                </a>
              </>
            )}
          </div>
          {!signedIn && (
            <p className="text-sm font-medium text-white/60">
              No account is needed to try it. With a free account, your results follow you to every device.
            </p>
          )}
        </div>
        {/* Two whole phones, side by side, the left one a little lower: the board and the panel under it show in full. */}
        <div className="flex justify-center items-start gap-4 sm:gap-5">
          <Phone shot={SHOTS.survival} className="w-[44%] max-w-[250px] mt-12" />
          <Phone shot={SHOTS.woodpecker} className="w-[44%] max-w-[250px]" />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-label="How the training works" data-testid="welcome-guides">
        <h3 className="text-2xl font-bold text-white tracking-tight">How the training works</h3>
        <div className="flex flex-col gap-5">
          {GUIDES.map((guide) => {
            const Icon = guide.icon;
            return (
              <article key={guide.id} id={guide.id} className={`${CARD} p-5 sm:p-7 flex flex-col gap-5`}>
                <h4 className="flex items-center gap-3 text-xl sm:text-2xl font-bold text-white tracking-tight">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${guide.tint}`}>
                    <Icon className="w-5 h-5" aria-hidden={true} />
                  </span>
                  {guide.title}
                </h4>
                {/* The text and the list side by side, both under the title. */}
                <div className="grid gap-4 md:grid-cols-[1.3fr_1fr] items-start">
                  <div className="flex flex-col gap-3">
                    <p className="text-[15px] font-medium text-white/80 leading-relaxed">{guide.text}</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1">
                      {guide.links.map((link) => (
                        <a key={link.href} href={link.href} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#39ff88] no-underline hover:underline underline-offset-2">
                          {link.label} <ArrowRight className="w-4 h-4" aria-hidden={true} />
                        </a>
                      ))}
                    </div>
                  </div>
                  <ul className="flex flex-col gap-2 md:pt-1">
                    {guide.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm font-medium text-white/75 leading-snug">
                        <Check className="w-4 h-4 text-[#39ff88] shrink-0 mt-px" aria-hidden={true} /> {point}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-white/10 pt-5">{guide.extra}</div>
              </article>
            );
          })}
        </div>
      </section>

      {!premium && (
        <section className="flex flex-col gap-4" aria-label="Pricing">
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">Free to train, Premium to go further</h3>
            <p className="mt-1 text-[15px] font-medium text-white/70 leading-relaxed max-w-[70ch]">
              Everything is free to start. Premium opens every Woodpecker and Blindfold option and the e-books.
            </p>
          </div>
          <div data-testid="welcome-premium">
            <PricingPlans
              action={(plan) =>
                plan === 'free' ? (
                  <a href="/login?tab=signup&next=%2F" className={`${SECONDARY_BUTTON_CLASS} !min-h-[48px] flex items-center justify-center no-underline`}>
                    Create a free account
                  </a>
                ) : (
                  <a href="/pricing" className={`${plan === 'yearly' ? PRIMARY_BUTTON_CLASS : `${SECONDARY_BUTTON_CLASS} !min-h-[48px]`} flex items-center justify-center no-underline`}>
                    Choose {plan} plan
                  </a>
                )
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/pricing" className={`${SECONDARY_BUTTON_CLASS} sm:w-auto px-5 flex items-center justify-center no-underline`}>
              Compare the plans and subscribe
            </a>
            <span className="text-sm font-medium text-white/60">Payment is handled by Dodo Payments. Cancel at any time.</span>
          </div>
        </section>
      )}
    </div>
  );
}
