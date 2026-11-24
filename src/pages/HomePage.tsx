import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import AppShell from '../components/AppShell';
import { MODE_ITEMS } from '../components/Sidebar';
import { StatTile } from '../components/panelUi';
import { loadLastMode } from '../utils/lastMode';
import { readSavedUsername } from '../utils/profile';
import { collectHomeStats } from '../utils/stats';

const CARD_BASE =
  'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Landing page: the results of every mode, and a way back into training. */
export default function HomePage() {
  const [stats] = useState(() => collectHomeStats());
  const [username] = useState(() => readSavedUsername());
  const [lastMode] = useState(() => {
    const path = loadLastMode();
    return MODE_ITEMS.find((item) => item.href === path) ?? null;
  });
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    document.title = 'Chess Tactics Guide | Chess training: endgames, puzzles and blindfold';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Free chess training: the Woodpecker method for endgames, puzzle streaks and races, coordinates and blindfold drills. Your results stay in your browser.',
      );
  }, []);

  const { summary } = stats;
  const cont = lastMode ?? MODE_ITEMS[0];

  return (
    <AppShell username={username} muted={muted} onToggleMute={() => setMuted((v) => !v)}>
      <div className="max-w-[980px] flex flex-col gap-6" data-testid="home">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {username ? `Welcome back, ${username}` : 'Welcome to Chess Tactics Guide'}
          </h2>
          <p className="mt-1.5 text-sm sm:text-base font-medium text-white/70">
            Your results at a glance. Everything is saved in this browser only.
          </p>
        </div>

        <a
          href={cont.href}
          data-testid="continue"
          className={`${CARD_BASE} px-5 py-4 flex items-center justify-between gap-4 hover:border-[#39ff88]/60 transition-colors focus-visible:outline-2 focus-visible:outline-[#39ff88]`}
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-white/60">
              {lastMode ? 'Continue where you left off' : 'New here? Start with'}
            </span>
            <span className="text-lg font-bold text-white">{cont.label}</span>
          </span>
          <span className="flex items-center gap-2 text-sm font-bold text-[#39ff88]">
            {lastMode ? 'Continue' : 'Start'}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </a>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="summary">
          <StatTile label="Records set" value={String(summary.records)} tone="good" />
          <StatTile label="Woodpecker cycles" value={String(summary.woodpeckerCycles)} />
          <StatTile label="Best streak" value={summary.bestStreak > 0 ? String(summary.bestStreak) : '–'} />
          <StatTile label="Best 3 min race" value={summary.bestRace3 > 0 ? String(summary.bestRace3) : '–'} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODE_ITEMS.map((item) => {
            const Icon = item.icon;
            const lines = stats.modes[item.id] ?? [];
            return (
              <a
                key={item.id}
                href={item.href}
                data-testid={`mode-${item.id}`}
                className={`${CARD_BASE} p-5 flex flex-col gap-3 hover:border-[#39ff88]/60 transition-colors focus-visible:outline-2 focus-visible:outline-[#39ff88]`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-[#101b2f] border border-white/10 flex items-center justify-center">
                      <Icon className="w-[18px] h-[18px] text-[#39ff88]" aria-hidden="true" />
                    </span>
                    <span className="text-lg font-bold text-white tracking-tight">{item.label}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-white/50" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-white/70 leading-relaxed">{item.description}</span>
                <span className="mt-auto pt-2 border-t border-white/10 flex flex-col gap-1.5">
                  {lines.length === 0 ? (
                    <span className="text-sm font-medium text-white/50" data-testid={`empty-${item.id}`}>
                      No results yet
                    </span>
                  ) : (
                    lines.map((line) => (
                      <span key={line.label} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-white/70">{line.label}</span>
                        <span className="font-bold text-white tabular-nums text-right">{line.value}</span>
                      </span>
                    ))
                  )}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
