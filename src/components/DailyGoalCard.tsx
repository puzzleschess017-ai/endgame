import { useEffect, useState } from 'react';
import { Check, Flame } from 'lucide-react';
import type { ActivityLog } from '../utils/activity';
import {
  GOAL_OPTIONS,
  celebrationDue,
  goalProgress,
  goalStreak,
  loadCelebrated,
  loadGoal,
  saveCelebrated,
  saveGoal,
} from '../utils/goal';
import { segmentClass } from './panelUi';

/** "Today you solved 12 of 20", a bar, the days in a row the goal was reached, and the choice of goal. */
export default function DailyGoalCard({ log }: { log: ActivityLog }) {
  const [goal, setGoal] = useState(() => loadGoal());
  const progress = goalProgress(log, goal);
  const streak = goalStreak(log, goal);
  const [celebrate, setCelebrate] = useState(false);
  // Reaching the goal (also when it was reached on another page): a short glow and a small shake, once for each goal reached.
  useEffect(() => {
    if (!celebrationDue(progress.reached, loadCelebrated(), progress.goal)) return;
    saveCelebrated(progress.goal);
    setCelebrate(true);
  }, [progress.reached, progress.goal]);
  const pick = (value: number) => {
    setGoal(value);
    saveGoal(value);
  };
  return (
    <section
      aria-label="Daily goal"
      data-testid="daily-goal"
      onAnimationEnd={() => setCelebrate(false)}
      className={`bg-[#16233b] border border-white/10 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.45)] px-5 py-4 flex flex-col gap-3 ${celebrate ? 'goal-celebrate' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Daily goal</h3>
          <p className="text-2xl font-bold tracking-tight tabular-nums text-white" data-testid="goal-text">
            {progress.today} <span className="text-white/50">/ {progress.goal}</span>
            <span className="ml-2 text-sm font-semibold text-white/70">puzzles today</span>
          </p>
        </div>
        <div className="text-right" data-testid="goal-streak">
          <p className={`flex items-center justify-end gap-1.5 text-2xl font-bold tracking-tight tabular-nums ${streak.current > 0 ? 'text-[#39ff88]' : 'text-white'}`}>
            <Flame className="w-5 h-5" aria-hidden="true" />
            <span data-testid="goal-streak-value">{streak.current}</span>
            <span className="text-sm font-semibold text-white/70">{streak.current === 1 ? 'day' : 'days'} in a row</span>
          </p>
          <p className="text-sm font-medium text-white/60">Best: {streak.best} {streak.best === 1 ? 'day' : 'days'}</p>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Today's progress"
        aria-valuemin={0}
        aria-valuemax={progress.goal}
        aria-valuenow={Math.min(progress.today, progress.goal)}
        className="h-2.5 rounded-full bg-[#101b2f] overflow-hidden"
      >
        <div
          data-testid="goal-bar"
          className={`h-full rounded-full transition-all duration-300 ${progress.reached ? 'bg-[#39ff88]' : 'bg-[#38bdf8]'}`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-white/70" data-testid="goal-note">
          {progress.reached ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-[#39ff88]">
              <Check className="w-4 h-4" aria-hidden="true" /> Goal reached
            </span>
          ) : (
            `${progress.goal - progress.today} more to reach today's goal`
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/60">Goal</span>
          <div className="flex gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10" role="group" aria-label="Daily goal in puzzles">
            {GOAL_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                data-testid={`goal-${option}`}
                aria-pressed={goal === option}
                onClick={() => pick(option)}
                className={`${segmentClass(goal === option, true)} px-3`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
