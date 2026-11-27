// What Home shows instead of empty statistics: to a visitor who has not trained yet (a first visit, or after signing
// out, when this browser holds no results) it says what the site is, with two phone screenshots, and shows the prices.
import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, EyeOff, LogIn, Repeat } from 'lucide-react';
import { LOGIN_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';
import PricingPlans from './PricingPlans';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

const SHOTS = {
  streak: { src: '/welcome/phone-streak.webp', alt: 'Puzzle Streak on a phone: a puzzle on the board and the current streak under it' },
  woodpecker: { src: '/welcome/phone-woodpecker.webp', alt: 'The Woodpecker Method on a phone: a puzzle on the board, with the cycle, the accuracy and the timers under it' },
};

interface Guide {
  id: string;
  title: string;
  icon: typeof Repeat;
  tint: string;
  text: ReactNode;
  points: string[];
  links: Array<{ href: string; label: string }>;
}

const GUIDES: Guide[] = [
  {
    id: 'woodpecker',
    title: 'The Woodpecker Method',
    icon: Repeat,
    tint: 'bg-amber-300/15 text-amber-300',
    text: (
      <>
        <p>
          A training idea from the grandmasters Hans Tikkanen and Axel Smith (their book came out in 2018). You take one fixed set
          of puzzles and solve the very same set again and again. Each round, called a cycle, you try to be faster than the last
          one without making more mistakes.
        </p>
        <p>
          Seeing the same positions over and over turns the patterns into habit, so in your own games you spot a fork, a pin or
          a mating net at a glance instead of calculating it from the start.
        </p>
      </>
    ),
    points: [
      'You choose how many puzzles and how many cycles',
      'Puzzles of every kind, or endgames only, from easy to expert',
      'Your time and accuracy are tracked for every cycle, then you review what you missed',
    ],
    links: [
      { href: '/woodpecker', label: 'Start a Woodpecker set' },
      { href: '/about', label: 'Read more' },
    ],
  },
  {
    id: 'blindfold',
    title: 'Blindfold training',
    icon: EyeOff,
    tint: 'bg-pink-400/15 text-pink-300',
    text: (
      <>
        <p>
          Memorize the position, then the pieces vanish and you find the checkmate from memory, typing the move yourself. Seeing
          the board in your head is the skill behind calculating long lines, and like any skill it can be trained.
        </p>
        <p>
          Start with few pieces and a mate in one, then add pieces, shorten the time you may look, and go for mate in two or
          three. A second part, Drills, trains the board in your head with quick questions against the clock.
        </p>
      </>
    ),
    points: [
      'Mate in 1, 2 or 3, with 5 to 20 seconds to memorize the position',
      'Drills: square colours, checks, attacks, diagonals, knight moves, distances, counting and more',
      'Rebuild a whole position on the empty board from memory',
    ],
    links: [{ href: '/blindfold', label: 'Try blindfold' }],
  },
  {
    id: 'books',
    title: 'Free chess books',
    icon: BookOpen,
    tint: 'bg-fuchsia-300/15 text-fuchsia-300',
    text: (
      <>
        <p>
          Seven chess books as PDF files, with diagrams, plans, traps and exercises. They are free to download with Premium, with
          nothing more to buy, and you keep the files.
        </p>
        <p>
          Read about an idea in a book, then train it here: the endgame book goes with Woodpecker and Endgame Theory, the tactics
          workbook with Puzzle Streak.
        </p>
      </>
    ),
    points: [
      'The Queen’s Gambit: A Practical Guide and a Caro-Kann repertoire',
      '100 Checkmate Patterns and 100 Essential Endgames',
      'The Ultimate Chess Tactics Workbook, Openings Made Simple and How to Think Like a Chess Master',
    ],
    links: [
      { href: '/ebooks', label: 'See the books' },
      { href: '/pricing', label: 'See Premium' },
    ],
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
          <Phone shot={SHOTS.streak} className="w-[44%] max-w-[250px] mt-12" />
          <Phone shot={SHOTS.woodpecker} className="w-[44%] max-w-[250px]" />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-label="How the training works" data-testid="welcome-guides">
        <h3 className="text-2xl font-bold text-white tracking-tight">How the training works</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {GUIDES.map((guide) => {
            const Icon = guide.icon;
            return (
              <article key={guide.id} id={guide.id} className={`${CARD} p-5 sm:p-6 flex flex-col gap-3`}>
                <h4 className="flex items-center gap-3 text-xl font-bold text-white tracking-tight">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${guide.tint}`}>
                    <Icon className="w-5 h-5" aria-hidden={true} />
                  </span>
                  {guide.title}
                </h4>
                <div className="flex flex-col gap-2 text-[15px] font-medium text-white/80 leading-relaxed">{guide.text}</div>
                <ul className="flex flex-col gap-1.5">
                  {guide.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm font-medium text-white/75 leading-snug">
                      <Check className="w-4 h-4 text-[#39ff88] shrink-0 mt-px" aria-hidden={true} /> {point}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2 flex flex-wrap gap-x-5 gap-y-1">
                  {guide.links.map((link) => (
                    <a key={link.href} href={link.href} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#39ff88] no-underline hover:underline underline-offset-2">
                      {link.label} <ArrowRight className="w-4 h-4" aria-hidden={true} />
                    </a>
                  ))}
                </div>
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
