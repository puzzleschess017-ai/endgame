import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const s = await import('./streak.ts');

beforeEach(() => store.clear());

test('best streak starts at 0 and only improves', () => {
  assert.equal(s.loadBestStreak(), 0);
  assert.deepEqual(s.saveBestStreak(0), { best: 0, isNewBest: false });
  assert.deepEqual(s.saveBestStreak(7), { best: 7, isNewBest: true });
  assert.deepEqual(s.saveBestStreak(7), { best: 7, isNewBest: false });
  assert.deepEqual(s.saveBestStreak(3), { best: 7, isNewBest: false });
  assert.deepEqual(s.saveBestStreak(12), { best: 12, isNewBest: true });
  assert.equal(s.loadBestStreak(), 12);
});

test('corrupt saved value is treated as no record', () => {
  store.set(s.STREAK_BEST_STORAGE_KEY, 'garbage');
  assert.equal(s.loadBestStreak(), 0);
  assert.deepEqual(s.saveBestStreak(4), { best: 4, isNewBest: true });
  store.set(s.STREAK_BEST_STORAGE_KEY, '-5');
  assert.equal(s.loadBestStreak(), 0);
});

const PUZZLE = {
  puzzleId: 'abc',
  fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  moves: ['a1a2', 'h1g1'],
  rating: 900,
  ratingDeviation: 80,
  popularity: 99,
  themes: [],
  numMoves: 2,
};

test('a running streak is saved and loaded back', () => {
  assert.equal(s.loadStreakRun(), null);
  s.saveStreakRun({ streak: 6, skipsLeft: 0, rung: 7, puzzle: PUZZLE, activeMs: 42000 }, 1000);
  assert.deepEqual(s.loadStreakRun(1500), {
    streak: 6, skipsLeft: 0, rung: 7, puzzle: PUZZLE, activeMs: 42000, savedAt: 1000,
  });
  s.saveStreakRun({ streak: 7, skipsLeft: 0, rung: 7, puzzle: null, activeMs: 50000 }, 2000);
  assert.equal(s.loadStreakRun(2500)?.puzzle, null);
  s.clearStreakRun();
  assert.equal(s.loadStreakRun(), null);
});

test('an old or damaged saved run is ignored', () => {
  s.saveStreakRun({ streak: 3, skipsLeft: 1, rung: 3, puzzle: PUZZLE, activeMs: 1 }, 1000);
  assert.equal(s.loadStreakRun(1000 + s.STREAK_RUN_MAX_AGE_MS + 1), null);
  store.set(s.STREAK_RUN_STORAGE_KEY, 'not json');
  assert.equal(s.loadStreakRun(), null);
  store.set(s.STREAK_RUN_STORAGE_KEY, JSON.stringify({ streak: -1, skipsLeft: 1, rung: 0, puzzle: null, activeMs: 0, savedAt: Date.now() }));
  assert.equal(s.loadStreakRun(), null);
  store.set(s.STREAK_RUN_STORAGE_KEY, JSON.stringify({ streak: 1, skipsLeft: 1, rung: 1, puzzle: { fen: 1 }, activeMs: 0, savedAt: Date.now() }));
  assert.equal(s.loadStreakRun(), null);
});
