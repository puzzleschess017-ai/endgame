// What Home shows instead of empty statistics: to a visitor who has not trained yet (a first visit, or after signing
// out, when this browser holds no results) it says what the site is, with two phone screenshots, and shows the prices.
import { ArrowRight, LogIn } from 'lucide-react';
import { LOGIN_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';
import PricingPlans from './PricingPlans';

const CARD = 'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

const SHOTS = {
  streak: { src: '/welcome/phone-streak.webp', alt: 'The Puzzle Streak page on a phone: the board, the three rules and the Start button' },
  woodpecker: { src: '/welcome/phone-woodpecker.webp', alt: 'The Woodpecker setup on a phone: the board, number of puzzles, cycles, puzzle type and difficulty' },
};

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
