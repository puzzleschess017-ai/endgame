// Everything Home shows: the best results of every mode, read from localStorage.
import type { TrainingSession } from '../types';
import { BLINDFOLD_LEVELS, ROUND_SIZE, levelDescription, loadBlindfoldBest } from './blindfold';
import { formatDuration, loadSessionFromStorage } from './chessHelpers';
import { loadBestScore } from './coordinates';
import { DRILL_KINDS, drillLabel, loadDrillBest } from './drills';
import { RACE_DURATIONS, durationLabel, loadRaceBest } from './race';
import { loadBestStreak } from './streak';
import { loadWoodpeckerHistory, summarizeWoodpecker } from './woodpeckerHistory';

export interface StatLine {
  label: string;
  value: string;
}

export interface HomeStats {
  /** Lines per mode id (see MODE_ITEMS). Empty means "no results yet". */
  modes: Record<string, StatLine[]>;
  /** The four numbers at the top of Home. */
  summary: { records: number; woodpeckerCycles: number; bestStreak: number; bestRace3: number };
}

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

  const blindfoldBests = BLINDFOLD_LEVELS.map((level) => ({ level, best: loadBlindfoldBest(level) }));
  const drillBests = DRILL_KINDS.map((kind) => ({ kind, best: loadDrillBest(kind) }));
  const blindfoldLines: StatLine[] = [
    ...blindfoldBests
      .filter((b) => b.best > 0)
      .map((b) => ({ label: `Mate in 1, ${levelDescription(b.level)}`, value: `${b.best}/${ROUND_SIZE}` })),
    ...drillBests.filter((b) => b.best > 0).map((b) => ({ label: drillLabel(b.kind), value: String(b.best) })),
  ];

  const records =
    coordinateLines.length +
    streakLines.length +
    raceLines.length +
    blindfoldLines.length +
    (wood.cycles > 0 ? 1 : 0);

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
  };
}
