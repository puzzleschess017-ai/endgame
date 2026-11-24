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

const r = await import('./race.ts');

beforeEach(() => store.clear());

test('the three lengths are 1, 3 and 5 minutes and a wrong move costs 10 seconds', () => {
  assert.deepEqual(r.RACE_DURATIONS, [60, 180, 300]);
  assert.deepEqual(r.RACE_DURATIONS.map(r.durationLabel), ['1 min', '3 min', '5 min']);
  assert.equal(r.WRONG_MOVE_PENALTY_MS, 10000);
});

test('formatClock rounds up and never goes below 0:00', () => {
  assert.equal(r.formatClock(300_000), '5:00');
  assert.equal(r.formatClock(179_001), '3:00');
  assert.equal(r.formatClock(59_000), '0:59');
  assert.equal(r.formatClock(9_100), '0:10');
  assert.equal(r.formatClock(1), '0:01');
  assert.equal(r.formatClock(0), '0:00');
  assert.equal(r.formatClock(-5000), '0:00');
});

test('raceAccuracy', () => {
  assert.equal(r.raceAccuracy(0, 0), 0);
  assert.equal(r.raceAccuracy(3, 1), 75);
  assert.equal(r.raceAccuracy(10, 0), 100);
  assert.equal(r.raceAccuracy(0, 4), 0);
});

test('settings default to 3 minutes and survive bad data', () => {
  assert.deepEqual(r.loadRaceSettings(), { duration: 180 });
  store.set(r.RACE_SETTINGS_STORAGE_KEY, '{oops');
  assert.deepEqual(r.loadRaceSettings(), { duration: 180 });
  store.set(r.RACE_SETTINGS_STORAGE_KEY, JSON.stringify({ duration: 90 }));
  assert.deepEqual(r.loadRaceSettings(), { duration: 180 });
  r.saveRaceSettings({ duration: 300 });
  assert.deepEqual(r.loadRaceSettings(), { duration: 300 });
  store.set(r.RACE_SETTINGS_STORAGE_KEY, JSON.stringify({ duration: 60, extra: 1 }));
  assert.deepEqual(r.loadRaceSettings(), { duration: 60 });
});

test('best score is kept per length and only improves', () => {
  assert.equal(r.loadRaceBest(60), 0);
  assert.deepEqual(r.saveRaceBest(60, 0), { best: 0, isNewBest: false });
  assert.deepEqual(r.saveRaceBest(60, 9), { best: 9, isNewBest: true });
  assert.deepEqual(r.saveRaceBest(60, 9), { best: 9, isNewBest: false });
  assert.deepEqual(r.saveRaceBest(60, 4), { best: 9, isNewBest: false });
  assert.deepEqual(r.saveRaceBest(60, 11), { best: 11, isNewBest: true });
  assert.equal(r.loadRaceBest(180), 0);
  assert.deepEqual(r.saveRaceBest(180, 25), { best: 25, isNewBest: true });
  assert.equal(r.loadRaceBest(60), 11);
  assert.equal(r.loadRaceBest(300), 0);
});

test('corrupt best-score storage does not throw', () => {
  store.set(r.RACE_BEST_STORAGE_KEY, 'garbage');
  assert.equal(r.loadRaceBest(60), 0);
  assert.deepEqual(r.saveRaceBest(60, 3), { best: 3, isNewBest: true });
  store.set(r.RACE_BEST_STORAGE_KEY, JSON.stringify({ 60: -2, 180: 'x' }));
  assert.equal(r.loadRaceBest(60), 0);
  assert.equal(r.loadRaceBest(180), 0);
});
