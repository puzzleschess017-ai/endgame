import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import BarChart, { type BarDatum } from '../components/BarChart';
import DailyGoalCard from '../components/DailyGoalCard';
import { PremiumCrown } from '../components/ProfileMenu';
import WelcomeIntro from '../components/WelcomeIntro';
import { useAuth } from '../auth';
import { segmentClass } from '../components/panelUi';
import { dailySeries } from '../utils/activity';
import { useSyncVersion } from '../sync';
import { readSavedUsername } from '../utils/profile';
import { collectOverview } from '../utils/stats';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const CARD_BASE =
  'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** "2026-11-24" -> a local Date at noon. */
function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function labels(day: string, range: Range): { label: string; fullLabel: string } {
  const date = parseDay(day);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const short = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return { label: range === 7 ? weekday : short, fullLabel: `${weekday} ${short}` };
}

/** Landing page: a dashboard with the overview of your training and charts over time. */
export default function HomePage() {
  // Read again when the results of the account arrive (a sync after the page opened).
  const syncVersion = useSyncVersion();
  const overview = useMemo(() => collectOverview(), [syncVersion]);
  const [username] = useState(() => readSavedUsername());
  const [range, setRange] = useState<Range>(7);
  const { session, tier } = useAuth();
  // Nothing trained in this browser yet (a first visit, or right after signing out): tell about the site, not zeros.
  const hasTrained = Object.keys(overview.log).length > 0;

  useEffect(() => {
    document.title = 'Chess Tactics Guide | Chess training: endgames, puzzles and blindfold';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Free chess training: Woodpecker endgames, puzzle streaks and survival runs, coordinates and blindfold drills. Sign in to keep your results on every device.',
      );
  }, []);

  const series = useMemo(() => dailySeries(overview.log, range), [overview.log, range]);
  const toData = (pick: (p: (typeof series)[number]) => number | null): BarDatum[] =>
    series.map((p) => ({ key: p.day, ...labels(p.day, range), value: pick(p) }));

  const rangeLabel = `last ${range} days`;

  return (
    <AppShell username={username}>
      <div className="max-w-[1100px] flex flex-col gap-8" data-testid="home">
        <h2 className="flex items-center gap-2.5 text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {username ? `Hello, ${username}!` : 'Hello!'}
          {tier === 'premium' && <PremiumCrown className="w-6 h-6 sm:w-7 sm:h-7" />}
        </h2>

        {!hasTrained ? (
          <WelcomeIntro signedIn={session !== null} premium={tier === 'premium'} />
        ) : (
          <>
            <DailyGoalCard log={overview.log} />

            <section className="flex flex-col gap-4" aria-label="Training overview">
              <h3 className="text-xl font-bold text-white tracking-tight">Training Overview</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3" data-testid="overview">
                {overview.tiles.map((tile) => (
                  <div
                    key={tile.id}
                    data-testid={`tile-${tile.id}`}
                    className={`${CARD_BASE} px-5 py-4 flex flex-col gap-1.5`}
                  >
                    <span className="text-sm font-semibold text-white leading-snug">{tile.label}</span>
                    <span
                      className={`text-3xl font-bold tracking-tight tabular-nums ${tile.tone === 'good' ? 'text-[#39ff88]' : 'text-white'}`}
                      data-testid={`value-${tile.id}`}
                    >
                      {tile.value}
                    </span>
                    <span className="text-sm font-medium text-white/60 leading-snug">{tile.sub}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-4" aria-label="Training analytics">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Training Analytics</h3>
                  <p className="text-sm font-medium text-white/60">Performance trends across {rangeLabel}</p>
                </div>
                <div className="flex gap-1 bg-[#16233b] p-1 rounded-xl border border-white/10" role="group" aria-label="Time range">
                  {RANGES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={range === r}
                      onClick={() => setRange(r)}
                      className={`${segmentClass(range === r)} px-3.5`}
                    >
                      {r} Days
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BarChart
                  id="sessions"
                  title="Daily Training Activity"
                  subtitle={`Sessions per day, ${rangeLabel}`}
                  data={toData((p) => p.sessions)}
                  color="#39ff88"
                  unit="sessions"
                  emptyText="No training in this period yet"
                />
                <BarChart
                  id="minutes"
                  title="Training Time"
                  subtitle={`Minutes per day, ${rangeLabel}`}
                  data={toData((p) => p.minutes)}
                  color="#38bdf8"
                  unit="min"
                  emptyText="No training in this period yet"
                />
                <BarChart
                  id="puzzles"
                  title="Puzzles Solved"
                  subtitle={`Puzzles per day, ${rangeLabel}`}
                  data={toData((p) => p.puzzles)}
                  color="#fbbf24"
                  unit="puzzles"
                  emptyText="No puzzles solved in this period yet"
                />
                <BarChart
                  id="accuracy"
                  title="Accuracy"
                  subtitle={`Correct answers per day, ${rangeLabel}`}
                  data={toData((p) => p.accuracy)}
                  color="#a78bfa"
                  unit="%"
                  fixedMax={100}
                  formatValue={(v) => String(Math.round(v))}
                  emptyText="No answers in this period yet"
                />
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
