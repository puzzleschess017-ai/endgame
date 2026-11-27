// What Home shows instead of empty statistics: to a visitor who has not trained yet (a first visit, or after signing
// out, when this browser holds no results) it says what the site is, what every tab does (with a screenshot of it)
// and what Premium adds, in that order, ending with the prices.
import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Database,
  EyeOff,
  Flame,
  Heart,
  Library,
  Pencil,
  Repeat,
  ScanSearch,
  Smartphone,
  Swords,
  Target,
  LogIn,
} from 'lucide-react';
import { LOGIN_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';
import PricingPlans from './PricingPlans';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

type Icon = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

interface Feature {
  id: string;
  group: string;
  title: string;
  icon: Icon;
  /** Tint of the icon tile, the same as the tab's colour in the menu. */
  tint: string;
  text: string;
  points: string[];
  href: string;
  cta: string;
  image: string;
  alt: string;
  /** The editor and the analysis board are made for a big screen, so they are shown on a computer, not a phone. */
  device?: 'phone' | 'desktop';
}

export const FEATURES: Feature[] = [
  {
    id: 'woodpecker',
    group: 'Puzzles',
    title: 'Woodpecker Method',
    icon: Repeat,
    tint: 'bg-amber-300/15 text-amber-300',
    text: 'The core of the site. You take one fixed set of puzzles and solve the very same set again and again. Each round, called a cycle, you try to finish faster than the last one without making more mistakes. Seeing the same positions over and over turns the patterns into habit, so you spot them at a glance in your own games.',
    points: [
      'Choose how many puzzles (from 10) and how many cycles',
      'Classic puzzles of every kind, or Endgame puzzles only, from easy to expert',
      'Time and accuracy for every cycle, then a review of the puzzles you missed',
    ],
    href: '/woodpecker',
    cta: 'Start a Woodpecker set',
    image: '/welcome/phone-woodpecker.webp',
    alt: 'The Woodpecker setup on a phone: number of puzzles, cycles, puzzle type and difficulty',
  },
  {
    id: 'streak',
    group: 'Puzzles',
    title: 'Puzzle Streak',
    icon: Flame,
    tint: 'bg-orange-400/15 text-orange-400',
    text: 'Puzzles start easy and get harder with every one you solve. How long can your streak last? One wrong move ends the run, and you may skip one puzzle per run. Puzzles come from the whole database, not only endgames, so you never know what is next.',
    points: ['One wrong move ends the streak', 'One skip per run for the position you cannot see', 'Your best streak is saved and shown on your statistics'],
    href: '/streak',
    cta: 'Try a streak',
    image: '/welcome/phone-streak.webp',
    alt: 'The Puzzle Streak page on a phone with its three rules and the Start button',
  },
  {
    id: 'survival',
    group: 'Puzzles',
    title: 'Puzzle Survival',
    icon: Heart,
    tint: 'bg-rose-400/15 text-rose-400',
    text: 'Solve puzzles for as long as you can. They start easy and get harder one by one. There is no clock, so take your time: you have three lives, every wrong move costs one, and the run ends when the last one is gone. Your score is the number of puzzles you solved.',
    points: ['Three lives and no clock', 'Calm thinking instead of speed', 'A personal best to beat every time'],
    href: '/survival',
    cta: 'Start surviving',
    image: '/welcome/phone-survival.webp',
    alt: 'The Puzzle Survival page on a phone: three lives, no clock and the Start button',
  },
  {
    id: 'coordinates',
    group: 'Training',
    title: 'Coordinate Training',
    icon: Target,
    tint: 'bg-violet-400/15 text-violet-300',
    text: 'Know every square without thinking. A square name appears and you click that square on the board as fast as you can. Score as many points as you can before the clock runs out, as White or as Black. Knowing the board by heart is the base for blindfold chess, for reading notation and for calculating quickly.',
    points: ['30 seconds or an endless round with no clock', 'Play as White or as Black', 'Your best score for each setting is saved'],
    href: '/coordinates',
    cta: 'Train the coordinates',
    image: '/welcome/phone-coordinates.webp',
    alt: 'The Coordinates Trainer on a phone with the time and colour options',
  },
  {
    id: 'blindfold',
    group: 'Training',
    title: 'Blindfold Training',
    icon: EyeOff,
    tint: 'bg-pink-400/15 text-pink-300',
    text: 'Memorize the position, then the pieces vanish and you find the checkmate from memory, typing the move yourself. Choose how many pieces are on the board, how long you may look and whether the mate takes one, two or three moves. A second part, Drills, trains the board in your head with quick questions.',
    points: [
      'Mate in 1, 2 or 3, with 6 to any number of pieces and 5 to 20 seconds to memorize',
      'Drills: square colours, checks, attacks, diagonals, knight moves, distances, counting and more',
      'Rebuild a position on the empty board from memory',
    ],
    href: '/blindfold',
    cta: 'Try blindfold',
    image: '/welcome/phone-blindfold.webp',
    alt: 'Blindfold Training on a phone: the mate in 1 setup with pieces, memorize time and the start button',
  },
  {
    id: 'editor',
    group: 'Tools',
    title: 'Board Editor',
    icon: Pencil,
    tint: 'bg-lime-300/15 text-lime-300',
    text: 'Build any position you like. Drag pieces onto the board or pick one and tap the squares, set who moves, castling rights and en passant, and paste or copy the position as a FEN. The editor tells you if the position is legal, and one button opens it in Board Analysis.',
    points: ['Drag, tap and delete pieces', 'Side to move, castling and en passant', 'Load and copy FEN, flip the board, reset or clear it'],
    href: '/editor',
    cta: 'Open the editor',
    image: '/welcome/desktop-editor.webp',
    alt: 'The Board Editor on a computer: the board with the piece tray, the side to move and the castling options',
    device: 'desktop',
  },
  {
    id: 'analysis',
    group: 'Tools',
    title: 'Board Analysis',
    icon: ScanSearch,
    tint: 'bg-sky-300/15 text-sky-300',
    text: 'Set up or load any position, play moves on the board and check them with the Stockfish engine, which runs in your browser. Step back and forward through your moves, flip the board and keep the notation next to it. It is the place where the lessons in the library open too.',
    points: ['Stockfish evaluation and best moves on demand', 'Move list with back and forward buttons', 'Start from any FEN or from the editor'],
    href: '/analysis',
    cta: 'Open the analysis board',
    image: '/welcome/desktop-analysis.webp',
    alt: 'Board Analysis on a computer: the board, the engine switch and the position as FEN',
    device: 'desktop',
  },
  {
    id: 'endgames',
    group: 'Library',
    title: 'Endgame Theory',
    icon: Library,
    tint: 'bg-yellow-300/15 text-yellow-300',
    text: 'Twelve short lessons on the endgames every player should know: opposition, the rule of the square, the Lucena and Philidor positions, the basic checkmates and the famous drawn positions. Each one has diagrams, the key idea in plain words and a button that opens the position in Board Analysis, so you can play it out and check it with the engine.',
    points: ['Twelve lessons, from pawn endings to rook and queen endings', 'A diagram and a plain explanation for each', 'Open any position in Board Analysis'],
    href: '/endgames',
    cta: 'Read the endgame lessons',
    image: '/welcome/phone-endgames.webp',
    alt: 'The Endgame Theory page on a phone with the first lesson and its diagram',
  },
  {
    id: 'openings',
    group: 'Library',
    title: 'Opening Theory',
    icon: Library,
    tint: 'bg-orange-300/15 text-orange-300',
    text: 'Twelve short lessons on the openings and ideas every player should know. Each one has diagrams, the plan in plain words and a button that opens the line in Board Analysis, so you can step through the moves and check them with the engine.',
    points: ['The Italian, the Ruy Lopez, the Sicilian, the French, the Queen’s Gambit and more', 'The plan, not just the moves', 'Step through every line on the analysis board'],
    href: '/openings',
    cta: 'Read the opening lessons',
    image: '/welcome/phone-openings.webp',
    alt: 'The Opening Theory page on a phone with the first lesson, the open games',
  },
  {
    id: 'tactics',
    group: 'Library',
    title: 'Tactics Theory',
    icon: Swords,
    tint: 'bg-teal-300/15 text-teal-300',
    text: 'Ten short lessons on the tactics every player should know: the fork, pin, skewer, discovered attack and double check, deflection, attraction and zugzwang, and the two most common mating patterns. Read the idea, play the position on the board, then train what you learned with puzzles.',
    points: ['Ten lessons, one pattern each', 'Diagrams you can open on the analysis board', 'Then practice it in Puzzle Streak or Woodpecker'],
    href: '/tactics',
    cta: 'Read the tactics lessons',
    image: '/welcome/phone-tactics.webp',
    alt: 'The Tactics Theory page on a phone with the first lesson, winning material',
  },
  {
    id: 'ebooks',
    group: 'Library',
    title: 'eBooks',
    icon: BookOpen,
    tint: 'bg-fuchsia-300/15 text-fuchsia-300',
    text: 'Chess books with diagrams, plans, traps and exercises: the Queen’s Gambit, 100 checkmate patterns, 100 essential endgames, a tactics workbook, openings made simple, how to think like a master and a Caro-Kann repertoire. They are free to download with Premium.',
    points: ['Eight books as PDF files', 'Diagrams, plans, traps and exercises', 'Free to download with Premium'],
    href: '/ebooks',
    cta: 'See the books',
    image: '/welcome/phone-ebooks.webp',
    alt: 'The eBooks page on a phone with the cover of the Queen’s Gambit guide',
  },
  {
    id: 'statistics',
    group: 'Progress',
    title: 'Statistics',
    icon: BarChart3,
    tint: 'bg-emerald-300/15 text-emerald-300',
    text: 'Your best results in every mode in one place, with charts of sessions, training time, puzzles solved and accuracy for each day. As a guest they are saved in this browser only; with a free account they follow you to every device. A daily goal and a streak of training days keep you coming back.',
    points: ['Records for every mode', 'Daily goal and day streak', 'A free account keeps everything on every device'],
    href: '/statistics',
    cta: 'See your statistics',
    image: '/welcome/phone-statistics.webp',
    alt: 'The Statistics page on a phone with the records of each mode',
  },
];

const STATS: Array<{ icon: Icon; title: string; text: string; tint: string }> = [
  { icon: Database, title: '120,000+', text: 'Puzzles from Lichess', tint: 'text-sky-300' },
  { icon: Repeat, title: 'Woodpecker Method', text: 'The same set, faster every cycle', tint: 'text-amber-300' },
  { icon: Smartphone, title: 'Every device', text: 'Phone, tablet or computer, no download', tint: 'text-[#39ff88]' },
];

/** A phone or a computer around a screenshot. */
function Screen({ feature, eager = false }: { feature: Pick<Feature, 'image' | 'alt' | 'device'>; eager?: boolean }) {
  if (feature.device === 'desktop') {
    return (
      <div className="w-full rounded-xl border border-white/15 bg-[#0b1424] overflow-hidden shadow-[0_20px_50px_rgba(4,9,20,0.55)]">
        <div className="flex gap-1.5 px-3 py-2 bg-[#0b1424] border-b border-white/10" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
        </div>
        <img src={feature.image} alt={feature.alt} width={1280} height={800} loading={eager ? 'eager' : 'lazy'} className="w-full h-auto block" />
      </div>
    );
  }
  return (
    <div className="mx-auto w-[210px] sm:w-[240px] rounded-[2rem] border-[6px] border-[#0b1424] ring-1 ring-white/20 bg-[#0b1424] overflow-hidden shadow-[0_20px_50px_rgba(4,9,20,0.55)]">
      <img
        src={feature.image}
        alt={feature.alt}
        width={780}
        height={1560}
        loading={eager ? 'eager' : 'lazy'}
        className="w-full h-auto block rounded-[1.5rem]"
      />
    </div>
  );
}

function FeatureSection({ feature, flip }: { feature: Feature; flip: boolean }) {
  const Icon = feature.icon;
  return (
    <article
      id={feature.id}
      data-testid={`feature-${feature.id}`}
      className={`${CARD} p-5 sm:p-7 grid gap-6 items-center ${feature.device === 'desktop' ? 'lg:grid-cols-[1fr_1.25fr]' : 'lg:grid-cols-[1fr_300px]'}`}
    >
      <div className={`flex flex-col gap-3 ${flip ? 'lg:order-2' : ''}`}>
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">{feature.group}</span>
        <h3 className="flex items-center gap-3 text-2xl font-bold text-white tracking-tight">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${feature.tint}`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
          {feature.title}
        </h3>
        <p className="text-[15px] font-medium text-white/80 leading-relaxed">{feature.text}</p>
        <ul className="flex flex-col gap-1.5">
          {feature.points.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm font-medium text-white/75 leading-snug">
              <Check className="w-4 h-4 text-[#39ff88] shrink-0 mt-px" aria-hidden="true" /> {point}
            </li>
          ))}
        </ul>
        <a
          href={feature.href}
          className="mt-1 inline-flex items-center gap-1.5 self-start text-sm font-bold text-[#39ff88] no-underline hover:underline underline-offset-2"
        >
          {feature.cta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </a>
      </div>
      <div className={flip ? 'lg:order-1' : ''}>
        <Screen feature={feature} />
      </div>
    </article>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <div>
        <h3 className="text-2xl font-bold text-white tracking-tight">{title}</h3>
        {subtitle && <p className="mt-1 text-[15px] font-medium text-white/70 leading-relaxed max-w-[70ch]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function WelcomeIntro({ signedIn, premium }: { signedIn: boolean; premium: boolean }) {
  return (
    <div className="flex flex-col gap-10" data-testid="welcome">
      <section className={`${CARD} p-6 sm:p-9 grid gap-8 grid-cols-[minmax(0,1fr)] lg:grid-cols-[1.3fr_1fr] items-center overflow-hidden`}>
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
            <a href="/woodpecker" data-testid="welcome-start" className={`${PRIMARY_BUTTON_CLASS} sm:w-auto px-6 flex items-center justify-center gap-2 no-underline`}>
              Start training <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            {!signedIn && (
              <>
                <a
                  href="/login?tab=signup&next=%2F"
                  data-testid="welcome-signup"
                  className={`${SECONDARY_BUTTON_CLASS} sm:w-auto px-5 flex items-center justify-center no-underline transition-all duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0`}
                >
                  Create account
                </a>
                <a
                  href="/login?next=%2F"
                  data-testid="welcome-signin"
                  className={`${LOGIN_BUTTON_CLASS} btn-shine-late sm:!w-auto px-5 flex items-center justify-center gap-2 no-underline`}
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
        <div className="relative flex justify-center items-start gap-3 sm:gap-4">
          <div className="w-[44%] max-w-[200px] mt-8 rotate-[-3deg]">
            <Screen feature={FEATURES[1]} eager />
          </div>
          <div className="w-[48%] max-w-[220px] rotate-[2deg]">
            <Screen feature={FEATURES[0]} eager />
          </div>
        </div>
      </section>

      <ul className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="welcome-stats">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <li key={stat.title} className={`${CARD} px-5 py-4 flex items-center gap-3`}>
              <Icon className={`w-6 h-6 shrink-0 ${stat.tint}`} aria-hidden="true" />
              <div>
                <p className="text-lg font-bold text-white leading-tight tracking-tight">{stat.title}</p>
                <p className="text-sm font-medium text-white/60 leading-snug">{stat.text}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <Section
        title="Everything on the site"
        subtitle="Every tab in the menu, what it does and how it helps your chess. All of the training is free to try, with no account."
      >
        <div className="flex flex-col gap-5">
          {FEATURES.map((feature, i) => (
            <FeatureSection key={feature.id} feature={feature} flip={i % 2 === 1} />
          ))}
        </div>
      </Section>

      {!premium && (
        <Section title="Free to train, Premium to go further" subtitle="Everything above is free to start. Premium opens every Woodpecker and Blindfold option and the e-books.">
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
        </Section>
      )}
    </div>
  );
}
