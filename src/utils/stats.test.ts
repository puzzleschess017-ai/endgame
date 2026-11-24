import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { collectHomeStats } from './stats.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => store.clear());

test('fresh browser: no results anywhere', () => {
  const stats = collectHomeStats();
  for (const id of ['woodpecker', 'coordinates', 'streak', 'race', 'blindfold']) {
    assert.deepEqual(stats.modes[id], [], id);
  }
  assert.deepEqual(stats.summary, { records: 0, woodpeckerCycles: 0, bestStreak: 0, bestRace3: 0 });
});

test('results of every mode show up', () => {
  store.set('ctg_streak_best_v1', '14');
  store.set('ctg_race_best_v1', '{"60":9,"180":21}');
  store.set('ctg_blindfold_best_v1', '{"6":8,"32":3}');
  store.set('ctg_drills_best_v1', '{"color":31,"knight":12}');
  store.set('ctg_coordinates_best_v1', '{"find_30":22,"find_60":41}');
  store.set(
    'ctg_woodpecker_history_v1',
    JSON.stringify([{ key: 'a:1', completedAt: 1, correct: 50, incorrect: 0, accuracy: 100, timeMs: 480000, puzzleCount: 50, difficulty: 'medium' }]),
  );
  const { modes, summary } = collectHomeStats();
  assert.deepEqual(modes.streak, [{ label: 'Best streak', value: '14' }]);
  assert.deepEqual(modes.race, [
    { label: '1 min race', value: '9 solved' },
    { label: '3 min race', value: '21 solved' },
  ]);
  assert.deepEqual(modes.coordinates.map((l) => l.value), ['22', '41']);
  assert.deepEqual(
    modes.blindfold.map((l) => `${l.label}=${l.value}`),
    ['Mate in 1, up to 6 pieces=8/10', 'Mate in 1, any number of pieces=3/10', 'Square color=31', 'Knight route=12'],
  );
  assert.deepEqual(modes.woodpecker.map((l) => l.label), ['Cycles finished', 'Puzzles solved', 'Best accuracy', 'Fastest perfect cycle']);
  assert.equal(modes.woodpecker[3].value, '08:00');
  assert.deepEqual(summary, { records: 10, woodpeckerCycles: 1, bestStreak: 14, bestRace3: 21 });
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
  store.set('ctg_race_best_v1', '[1,2');
  store.set('ctg_blindfold_best_v1', '"x"');
  store.set('endgame_woodpecker_session_v1', '{{{');
  const { summary } = collectHomeStats();
  assert.deepEqual(summary, { records: 0, woodpeckerCycles: 0, bestStreak: 0, bestRace3: 0 });
});
