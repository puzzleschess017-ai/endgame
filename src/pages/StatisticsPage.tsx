import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import { MODE_ITEMS } from '../components/Sidebar';
import { useAuth } from '../auth';
import { useSyncVersion } from '../sync';
import { readSavedUsername } from '../utils/profile';
import { collectHomeStats } from '../utils/stats';
import LineChart from '../components/LineChart';
import { formatDuration } from '../utils/chessHelpers';
import { loadWoodpeckerHistory } from '../utils/woodpeckerHistory';
import { accuracyAxis, groupSets, speedSummary, type ProgressSet } from '../utils/progress';

const SETS_SHOWN = 20;

function setLabel(set: ProgressSet): string {
  const date = new Date(set.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const cycles = set.cycles.length;
  return `${date} · ${set.puzzleCount} puzzles · ${cycles} ${cycles === 1 ? 'cycle' : 'cycles'}`;
}

const CARD_BASE =
  'bg-card border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(131,24,67,0.14)]';

/** Personal records of every mode and the last Woodpecker cycles. */
export default function StatisticsPage() {
  const { session } = useAuth();
  const syncVersion = useSyncVersion();
  const stats = useMemo(() => collectHomeStats(), [syncVersion]);
  const [username] = useState(() => readSavedUsername());
  const sets = useMemo(() => groupSets(loadWoodpeckerHistory()).slice(0, SETS_SHOWN), [syncVersion]);
  const [chosenSet, setChosenSet] = useState<string | null>(null);
  const progressSet = sets.find((s) => s.id === chosenSet) ?? sets[0];

  useEffect(() => {
    document.title = 'Statistics | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', 'Your personal records in every chess training mode, saved on your account or in your browser.');
  }, []);

  const { recentCycles } = stats;

  return (
    <AppShell username={username}>
      <div className="max-w-[860px] flex flex-col gap-6" data-testid="statistics">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Statistics</h2>
          <p className="mt-1.5 text-sm sm:text-base font-medium text-white/70">
            {session
              ? 'Your best results in every mode. They are saved on your account and follow you to every device.'
              : 'Your best results in every mode. As a guest they are saved in this browser only: sign in to keep them on every device.'}
          </p>
        </div>

        <section className={`${CARD_BASE} p-6 flex flex-col gap-5`} data-testid="records" aria-label="Your records">
          <h3 className="text-lg font-bold text-white tracking-tight">Your records</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
            {MODE_ITEMS.map((item) => {
              const lines = stats.modes[item.id] ?? [];
              const Icon = item.icon;
              return (
                <div key={item.id} data-testid={`section-${item.id}`} className="flex flex-col gap-2">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60">
                    <Icon className={`w-4 h-4 ${item.iconClass}`} aria-hidden="true" />
                    {item.label}
                  </h4>
                  {lines.length === 0 ? (
                    <p className="text-sm font-medium text-white/50" data-testid={`empty-${item.id}`}>
                      No results yet
                    </p>
                  ) : (
                    <dl className="flex flex-col gap-1.5">
                      {lines.map((line) => (
                        <div key={line.label} className="flex items-baseline justify-between gap-3 text-sm">
                          <dt className="font-medium text-white/70">{line.label}</dt>
                          <dd className="font-bold text-white tabular-nums text-right">{line.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {progressSet && (
          <section className={`${CARD_BASE} p-6 flex flex-col gap-4`} data-testid="progress" aria-label="Woodpecker progress">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Woodpecker progress</h3>
                <p className="text-sm font-medium text-white/60" data-testid="progress-summary">
                  {speedSummary(progressSet) ?? 'Finish a second cycle of the same puzzles to see your progress.'}
                </p>
              </div>
              {sets.length > 1 && (
                <label className="flex flex-col gap-1 text-xs font-semibold text-white/60">
                  Set of puzzles
                  <select
                    value={progressSet.id}
                    onChange={(e) => setChosenSet(e.target.value)}
                    className="rounded-lg bg-card border border-white/15 px-3 py-2 text-sm font-semibold text-white"
                    data-testid="progress-set"
                  >
                    {sets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {setLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LineChart
                id="speed"
                title="Speed"
                subtitle="Seconds per puzzle in each cycle, lower is faster"
                points={progressSet.cycles.map((c) => ({
                  key: `c${c.cycle}`,
                  label: String(c.cycle),
                  fullLabel: `Cycle ${c.cycle} (${formatDuration(c.timeMs)})`,
                  value: c.seconds,
                }))}
                color="#38bdf8"
                unit="s per puzzle"
                xTitle="Cycle"
                badge={`Latest: ${progressSet.cycles[progressSet.cycles.length - 1].seconds.toFixed(1)} s`}
                formatValue={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
              />
              <LineChart
                id="accuracy"
                title="Accuracy"
                subtitle="Puzzles solved without a mistake in each cycle"
                points={progressSet.cycles.map((c) => ({
                  key: `c${c.cycle}`,
                  label: String(c.cycle),
                  fullLabel: `Cycle ${c.cycle} (${c.solved}/${c.total})`,
                  value: Math.round(c.accuracy),
                }))}
                color="#a78bfa"
                unit="%"
                xTitle="Cycle"
                {...accuracyAxis(progressSet.cycles.map((c) => c.accuracy))}
                badge={`Latest: ${Math.round(progressSet.cycles[progressSet.cycles.length - 1].accuracy)}%`}
                formatValue={(v) => `${Math.round(v)}`}
              />
            </div>
          </section>
        )}

        {recentCycles.length > 0 && (
          <section className={`${CARD_BASE} p-6 flex flex-col gap-3`} data-testid="recent" aria-label="Recent Woodpecker cycles">
            <h3 className="text-lg font-bold text-white tracking-tight">Recent Woodpecker cycles</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-white/50">
                  <th className="py-1.5 font-semibold">Date</th>
                  <th className="py-1.5 font-semibold">Solved</th>
                  <th className="py-1.5 font-semibold">Accuracy</th>
                  <th className="py-1.5 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentCycles.map((cycle, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="py-2 font-medium text-white/70">{cycle.date}</td>
                    <td className="py-2 font-bold text-white tabular-nums">{cycle.puzzles}</td>
                    <td className="py-2 font-bold text-white tabular-nums">{cycle.accuracy}</td>
                    <td className="py-2 font-bold text-white tabular-nums text-right">{cycle.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  );
}
