import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import { MODE_ITEMS } from '../components/Sidebar';
import { readSavedUsername } from '../utils/profile';
import { collectHomeStats } from '../utils/stats';

const CARD_BASE =
  'bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)]';

/** Personal records of every mode and the last Woodpecker cycles. */
export default function StatisticsPage() {
  const [stats] = useState(() => collectHomeStats());
  const [username] = useState(() => readSavedUsername());

  useEffect(() => {
    document.title = 'Statistics | Chess Tactics Guide';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', 'Your personal records in every chess training mode, saved in your browser.');
  }, []);

  const { recentCycles } = stats;

  return (
    <AppShell username={username}>
      <div className="max-w-[860px] flex flex-col gap-6" data-testid="statistics">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Statistics</h2>
          <p className="mt-1.5 text-sm sm:text-base font-medium text-white/70">
            Your best results in every mode. Everything is saved in this browser only.
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
