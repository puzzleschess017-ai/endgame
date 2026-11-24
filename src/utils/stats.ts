// Everything Home shows: the results of every mode, read from localStorage.
import type { TrainingSession } from '../types';
import { BLINDFOLD_LEVELS, MATE_IN_OPTIONS, ROUND_SIZE, levelDescription, loadBlindfoldBest } from './blindfold';
import { dayStreaks, formatTotalTime, loadActivity, totalActivity, type ActivityLog } from './activity';
import { formatDuration, loadSessionFromStorage } from './chessHelpers';
import { loadBestScore } from './coordinates';
import { QUESTION_KINDS, drillLabel, loadDrillBest } from './drills';
import { RECONSTRUCT_LEVELS, RECONSTRUCT_ROUND, loadReconstructBest } from './reconstruct';
import { RACE_DURATIONS, durationLabel, loadRaceBest } from './race';
import { loadBestStreak } from './streak';
import { loadWoodpeckerHistory, summarizeWoodpecker } from './woodpeckerHistory';

export interface StatLine {
  label: string;
  value: string;
}

export interface RecentCycle {
  /** e.g. "24 Nov". */
  date: string;
  puzzles: string;
  accuracy: string;
  time: string;
}

export interface HomeStats {
  /** Lines per mode id (see MODE_ITEMS). Empty means "no results yet". */
  modes: Record<string, StatLine[]>;
  /** The four numbers at the top of Home. */
  summary: { records: number; woodpeckerCycles: number; bestStreak: number; bestRace3: number };
  /** The last finished Woodpecker cycles, newest first. */
  recentCycles: RecentCycle[];
}

const RECENT_CYCLES_SHOWN = 5;

function currentSessionLine(session: TrainingSession | null): StatLine | null {
  if (!session || session.status === 'all_complete') return null;
  const total = session.puzzles.length;
  const done = Math.min(session.currentPuzzleIndex, total);
  return {
    label: 'In progress',
    value: `cycle ${session.currentCycle}/${session.config.totalCycles}, puzzle ${done}/${total}`,
  };
}

export function collectHomeStats(): HomeStats {
  const history = loadWoodpeckerHistory();
  const wood = summarizeWoodpecker(history);
  const woodLines: StatLine[] = [];
  if (wood.cycles > 0) {
    woodLines.push({ label: 'Cycles finished', value: String(wood.cycles) });
    woodLines.push({ label: 'Puzzles solved', value: String(wood.puzzlesSolved) });
    woodLines.push({ label: 'Best accuracy', value: `${wood.bestAccuracy}%` });
    if (wood.fastestPerfectMs !== null) {
      woodLines.push({ label: 'Fastest perfect cycle', value: formatDuration(wood.fastestPerfectMs) });
    }
  }
  const inProgress = currentSessionLine(loadSessionFromStorage());
  if (inProgress) woodLines.push(inProgress);

  const coordinateLines: StatLine[] = ([30, 60] as const)
    .map((d) => ({ label: `Find the square, ${d} s`, value: loadBestScore(d) }))
    .filter((l) => l.value > 0)
    .map((l) => ({ label: l.label, value: String(l.value) }));

  const bestStreak = loadBestStreak();
  const streakLines: StatLine[] = bestStreak > 0 ? [{ label: 'Best streak', value: String(bestStreak) }] : [];

  const raceBests = RACE_DURATIONS.map((d) => ({ d, best: loadRaceBest(d) }));
  const raceLines: StatLine[] = raceBests
    .filter((r) => r.best > 0)
    .map((r) => ({ label: `${durationLabel(r.d)} race`, value: `${r.best} solved` }));

  const blindfoldBests = MATE_IN_OPTIONS.flatMap((mateIn) =>
    BLINDFOLD_LEVELS.map((level) => ({ mateIn, level, best: loadBlindfoldBest(level, mateIn) })),
  );
  const drillBests = QUESTION_KINDS.map((kind) => ({ kind, best: loadDrillBest(kind) }));
  const blindfoldLines: StatLine[] = [
    ...blindfoldBests
      .filter((b) => b.best > 0)
      .map((b) => ({ label: `Mate in ${b.mateIn}, ${levelDescription(b.level)}`, value: `${b.best}/${ROUND_SIZE}` })),
    ...drillBests.filter((b) => b.best > 0).map((b) => ({ label: drillLabel(b.kind), value: String(b.best) })),
    ...RECONSTRUCT_LEVELS.map((level) => ({ level, best: loadReconstructBest(level) }))
      .filter((b) => b.best > 0)
      .map((b) => ({ label: `Rebuild position, up to ${b.level} pieces`, value: `${b.best}/${RECONSTRUCT_ROUND}` })),
  ];

  const records =
    coordinateLines.length +
    streakLines.length +
    raceLines.length +
    blindfoldLines.length +
    (wood.cycles > 0 ? 1 : 0);

  const recentCycles: RecentCycle[] = history
    .slice(-RECENT_CYCLES_SHOWN)
    .reverse()
    .map((r) => ({
      date: new Date(r.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      puzzles: `${r.correct}/${r.correct + r.incorrect}`,
      accuracy: `${Math.round(r.accuracy)}%`,
      time: formatDuration(r.timeMs),
    }));

  return {
    modes: {
      woodpecker: woodLines,
      coordinates: coordinateLines,
      streak: streakLines,
      race: raceLines,
      blindfold: blindfoldLines,
    },
    summary: {
      records,
      woodpeckerCycles: wood.cycles,
      bestStreak,
      bestRace3: raceBests.find((r) => r.d === 180)?.best ?? 0,
    },
    recentCycles,
  };
}

export interface OverviewTile {
  id: string;
  label: string;
  value: string;
  sub: string;
  /** Green numbers for streaks, white for the rest. */
  tone?: 'good';
}

/** The six tiles of "Training Overview" on Home and the activity log behind the charts. */
export function collectOverview(now: number = Date.now()): { tiles: OverviewTile[]; log: ActivityLog } {
  const log = loadActivity();
  const totals = totalActivity(log);
  const streaks = dayStreaks(log, now);
  const bestStreak = loadBestStreak();
  const wood = summarizeWoodpecker(loadWoodpeckerHistory());
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    log,
    tiles: [
      { id: 'puzzles', label: 'Puzzles Solved', value: String(totals.puzzles), sub: 'Across all puzzle modes' },
      {
        id: 'time',
        label: 'Total Training Time',
        value: formatTotalTime(totals.ms),
        sub: `${plural(totals.sessions, 'total session')}`,
      },
      {
        id: 'streak',
        label: 'Current Daily Streak',
        value: `${streaks.current}d`,
        sub: `Best streak: ${streaks.best}d`,
        tone: 'good',
      },
      {
        id: 'accuracy',
        label: 'Average Accuracy',
        value: totals.accuracy === null ? '–' : `${totals.accuracy}%`,
        sub: 'All training modes',
      },
      {
        id: 'bestStreak',
        label: 'Best Puzzle Streak',
        value: bestStreak > 0 ? String(bestStreak) : '–',
        sub: 'Puzzle Streak record',
        tone: 'good',
      },
      {
        id: 'woodpecker',
        label: 'Woodpecker Cycles',
        value: String(wood.cycles),
        sub: wood.cycles > 0 ? `Best accuracy: ${wood.bestAccuracy}%` : 'No cycles finished yet',
      },
    ],
  };
}
