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

const s = await import('./survival.ts');

beforeEach(() => store.clear());

test('three strikes end the run', () => {
  assert.equal(s.SURVIVAL_STRIKES, 3);
  assert.equal(s.strikesLeft(0), 3);
  assert.equal(s.strikesLeft(2), 1);
  assert.equal(s.strikesLeft(3), 0);
  assert.equal(s.strikesLeft(9), 0);
  assert.equal(s.strikesLeft(-1), 3);
});

test('survivalAccuracy', () => {
  assert.equal(s.survivalAccuracy(0, 0), 0);
  assert.equal(s.survivalAccuracy(9, 3), 75);
  assert.equal(s.survivalAccuracy(10, 0), 100);
  assert.equal(s.survivalAccuracy(0, 3), 0);
});

test('best score: only a higher score counts, and 0 never does', () => {
  assert.equal(s.loadSurvivalBest(), 0);
  assert.deepEqual(s.saveSurvivalBest(0), { best: 0, isNewBest: false });
  assert.deepEqual(s.saveSurvivalBest(12), { best: 12, isNewBest: true });
  assert.deepEqual(s.saveSurvivalBest(12), { best: 12, isNewBest: false });
  assert.deepEqual(s.saveSurvivalBest(7), { best: 12, isNewBest: false });
  assert.deepEqual(s.saveSurvivalBest(13.9), { best: 13, isNewBest: true });
  assert.equal(s.loadSurvivalBest(), 13);
});

test('a broken saved value reads as no record', () => {
  store.set(s.SURVIVAL_BEST_STORAGE_KEY, 'abc');
  assert.equal(s.loadSurvivalBest(), 0);
  store.set(s.SURVIVAL_BEST_STORAGE_KEY, '-4');
  assert.equal(s.loadSurvivalBest(), 0);
});

test('the ladder starts easy and climbs', () => {
  assert.equal(s.SURVIVAL_LADDER.start, 500);
  assert.ok(s.SURVIVAL_LADDER.step > 0);
});
