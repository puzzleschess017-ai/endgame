import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { recordActivity } from './activity.ts';
import { collectHomeStats, collectOverview } from './stats.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => store.clear());

test('fresh browser: no results anywhere', () => {
  const stats = collectHomeStats();
  for (const id of ['woodpecker', 'coordinates', 'streak', 'survival', 'blindfold']) {
    assert.deepEqual(stats.modes[id], [], id);
  }
  assert.deepEqual(stats.summary, { records: 0, woodpeckerCycles: 0, bestStreak: 0, bestSurvival: 0 });
});

test('results of every mode show up', () => {
  store.set('ctg_streak_best_v1', '14');
  store.set('ctg_survival_best_v1', '17');
  store.set('ctg_blindfold_best_v1', '{"6":8,"32":3}');
  store.set('ctg_drills_best_v1', '{"color":31,"knight":12}');
  store.set('ctg_coordinates_best_v1', '{"find_30":22,"find_60":41}');
  store.set(
    'ctg_woodpecker_history_v1',
    JSON.stringify([{ key: 'a:1', completedAt: 1, correct: 50, incorrect: 0, accuracy: 100, timeMs: 480000, puzzleCount: 50, difficulty: 'medium' }]),
  );
  const { modes, summary } = collectHomeStats();
  assert.deepEqual(modes.streak, [{ label: 'Best streak', value: '14' }]);
  assert.deepEqual(modes.survival, [{ label: 'Best run', value: '17 solved' }]);
  assert.deepEqual(modes.coordinates.map((l) => l.value), ['22', '41']);
  assert.deepEqual(
    modes.blindfold.map((l) => `${l.label}=${l.value}`),
    ['Mate in 1, up to 6 pieces=8/10', 'Mate in 1, any number of pieces=3/10', 'Square color=31', 'Knight route=12'],
  );
  assert.deepEqual(modes.woodpecker.map((l) => l.label), ['Cycles finished', 'Puzzles solved', 'Best accuracy', 'Fastest perfect cycle']);
  assert.equal(modes.woodpecker[3].value, '08:00');
  assert.deepEqual(summary, { records: 9, woodpeckerCycles: 1, bestStreak: 14, bestSurvival: 17 });
});

test('an unfinished Woodpecker session is shown as in progress', () => {
  const puzzle = { puzzleId: 'p', fen: '8/8/8/8/8/8/8/8 w - - 0 1', moves: ['a1a2'], rating: 1, ratingDeviation: 1, popularity: 1, themes: [], numMoves: 1 };
  store.set(
    'endgame_woodpecker_session_v1',
    JSON.stringify({
      id: 's',
      config: { puzzleCount: 10, totalCycles: 4, difficulty: 'medium' },
      puzzles: Array.from({ length: 10 }, () => puzzle),
      currentCycle: 2,
      currentPuzzleIndex: 3,
      status: 'training',
      cycleResults: [],
    }),
  );
  const { modes } = collectHomeStats();
  assert.deepEqual(modes.woodpecker, [{ label: 'In progress', value: 'cycle 2/4, puzzle 3/10' }]);
});

test('junk in storage does not break Home', () => {
  store.set('ctg_streak_best_v1', 'abc');
  store.set('ctg_survival_best_v1', '[1,2');
  store.set('ctg_blindfold_best_v1', '"x"');
  store.set('endgame_woodpecker_session_v1', '{{{');
  const { summary } = collectHomeStats();
  assert.deepEqual(summary, { records: 0, woodpeckerCycles: 0, bestStreak: 0, bestSurvival: 0 });
});

test('recent Woodpecker cycles: newest first, at most five', () => {
  const history = Array.from({ length: 7 }, (_, i) => ({
    key: `s:${i + 1}`,
    completedAt: Date.UTC(2026, 10, 10 + i, 12),
    correct: 40 + i,
    incorrect: 10 - i,
    accuracy: ((40 + i) / 50) * 100,
    timeMs: 600_000 - i * 10_000,
    puzzleCount: 50,
    difficulty: 'medium',
  }));
  store.set('ctg_woodpecker_history_v1', JSON.stringify(history));
  const { recentCycles } = collectHomeStats();
  assert.equal(recentCycles.length, 5);
  assert.deepEqual(
    { puzzles: recentCycles[0].puzzles, accuracy: recentCycles[0].accuracy, time: recentCycles[0].time },
    { puzzles: '46/50', accuracy: '92%', time: '09:00' },
  );
  assert.equal(recentCycles[4].puzzles, '42/50');
  assert.match(recentCycles[0].date, /^\d{1,2} [A-Z][a-z]{2}$/);
});

test('no cycles: no recent list', () => {
  assert.deepEqual(collectHomeStats().recentCycles, []);
});

test('overview of a fresh browser: zeros and dashes', () => {
  const { tiles } = collectOverview();
  const byId = Object.fromEntries(tiles.map((t) => [t.id, t]));
  assert.deepEqual(tiles.map((t) => t.id), ['puzzles', 'time', 'streak', 'accuracy', 'bestStreak', 'woodpecker']);
  assert.equal(byId.puzzles.value, '0');
  assert.equal(byId.time.value, '0s');
  assert.equal(byId.time.sub, '0 total sessions');
  assert.equal(byId.streak.value, '0d');
  assert.equal(byId.accuracy.value, '–');
  assert.equal(byId.bestStreak.value, '–');
  assert.equal(byId.woodpecker.sub, 'No cycles finished yet');
});

test('overview tiles reflect the activity log', () => {
  const now = new Date(2026, 10, 24, 15).getTime();
  const day = 86_400_000;
  recordActivity({ mode: 'survival', ms: 180_000, correct: 12, wrong: 3, puzzles: 12, now: now - day });
  recordActivity({ mode: 'streak', ms: 60_000, correct: 5, wrong: 1, puzzles: 5, now });
  recordActivity({ mode: 'drills', ms: 60_000, correct: 20, wrong: 0, now });
  store.set('ctg_streak_best_v1', '9');
  const { tiles } = collectOverview(now);
  const byId = Object.fromEntries(tiles.map((t) => [t.id, t]));
  assert.equal(byId.puzzles.value, '17');
  assert.equal(byId.time.value, '5m 00s');
  assert.equal(byId.time.sub, '3 total sessions');
  assert.equal(byId.streak.value, '2d');
  assert.equal(byId.streak.sub, 'Best streak: 2d');
  assert.equal(byId.accuracy.value, '90%');
  assert.equal(byId.bestStreak.value, '9');
});

test('a single session is not plural', () => {
  recordActivity({ mode: 'survival', ms: 1000, correct: 1, wrong: 0, puzzles: 1 });
  assert.equal(collectOverview().tiles.find((t) => t.id === 'time')!.sub, '1 total session');
});
