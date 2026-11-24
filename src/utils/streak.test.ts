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
