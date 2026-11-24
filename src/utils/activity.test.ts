import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  ACTIVITY_DAYS_KEPT,
  ACTIVITY_STORAGE_KEY,
  dailySeries,
  dayKey,
  dayStreaks,
  formatTotalTime,
  lastDays,
  loadActivity,
  recordActivity,
  totalActivity,
} from './activity.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => store.clear());

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

test('dayKey uses the local calendar day', () => {
  assert.equal(dayKey(at(2026, 11, 24, 0)), '2026-11-24');
  assert.equal(dayKey(at(2026, 1, 5, 23)), '2026-01-05');
});

test('recordActivity adds runs to the day and keeps totals', () => {
  recordActivity({ mode: 'race', ms: 180_000, correct: 12, wrong: 3, puzzles: 12, now: at(2026, 11, 24, 9) });
  recordActivity({ mode: 'coordinates', ms: 30_000, correct: 20, wrong: 5, now: at(2026, 11, 24, 18) });
  recordActivity({ mode: 'streak', ms: 90_000, correct: 7, wrong: 1, puzzles: 7, now: at(2026, 11, 25, 10) });
  const log = loadActivity();
  assert.deepEqual(log['2026-11-24'], { sessions: 2, ms: 210_000, puzzles: 12, correct: 32, wrong: 8 });
  assert.deepEqual(log['2026-11-25'], { sessions: 1, ms: 90_000, puzzles: 7, correct: 7, wrong: 1 });
  assert.deepEqual(totalActivity(log), { sessions: 3, ms: 300_000, puzzles: 19, accuracy: 81 });
});

test('totals of nothing: no accuracy', () => {
  assert.deepEqual(totalActivity({}), { sessions: 0, ms: 0, puzzles: 0, accuracy: null });
});

test('junk in storage is ignored and negative numbers do not count', () => {
  store.set(ACTIVITY_STORAGE_KEY, 'nope');
  assert.deepEqual(loadActivity(), {});
  store.set(ACTIVITY_STORAGE_KEY, '[1,2]');
  assert.deepEqual(loadActivity(), {});
  store.set(ACTIVITY_STORAGE_KEY, JSON.stringify({ 'bad-key': { sessions: 1 }, '2026-11-01': { sessions: -4, ms: 'x', correct: 3 } }));
  assert.deepEqual(loadActivity(), { '2026-11-01': { sessions: 0, ms: 0, puzzles: 0, correct: 3, wrong: 0 } });
  recordActivity({ mode: 'race', ms: -5, correct: -1, wrong: -1, puzzles: -1, now: at(2026, 11, 2) });
  assert.deepEqual(loadActivity()['2026-11-02'], { sessions: 1, ms: 0, puzzles: 0, correct: 0, wrong: 0 });
});

test('only the last 400 days are kept', () => {
  for (let i = 0; i < ACTIVITY_DAYS_KEPT + 30; i++) {
    recordActivity({ mode: 'race', ms: 1000, correct: 1, wrong: 0, now: at(2024, 1, 1) + i * 86_400_000 });
  }
  const keys = Object.keys(loadActivity()).sort();
  assert.equal(keys.length, ACTIVITY_DAYS_KEPT);
  assert.equal(keys[keys.length - 1], dayKey(at(2024, 1, 1) + (ACTIVITY_DAYS_KEPT + 29) * 86_400_000));
});

test('lastDays: oldest first, ends today, crosses month and year', () => {
  assert.deepEqual(lastDays(3, at(2026, 11, 24)), ['2026-11-22', '2026-11-23', '2026-11-24']);
  assert.deepEqual(lastDays(3, at(2026, 1, 1)), ['2025-12-30', '2025-12-31', '2026-01-01']);
  assert.equal(lastDays(90).length, 90);
  assert.equal(new Set(lastDays(90)).size, 90);
});

test('dailySeries: one point per day with minutes and accuracy', () => {
  recordActivity({ mode: 'race', ms: 90_000, correct: 3, wrong: 1, puzzles: 3, now: at(2026, 11, 24) });
  const series = dailySeries(loadActivity(), 3, at(2026, 11, 24));
  assert.deepEqual(series.map((p) => p.day), ['2026-11-22', '2026-11-23', '2026-11-24']);
  assert.deepEqual(series[0], { day: '2026-11-22', sessions: 0, minutes: 0, puzzles: 0, accuracy: null });
  assert.deepEqual(series[2], { day: '2026-11-24', sessions: 1, minutes: 1.5, puzzles: 3, accuracy: 75 });
});

test('day streaks: current counts through yesterday, best is the longest run', () => {
  const log = (days: string[]) => Object.fromEntries(days.map((d) => [d, { sessions: 1, ms: 1, puzzles: 0, correct: 0, wrong: 0 }]));
  const now = at(2026, 11, 24);
  assert.deepEqual(dayStreaks({}, now), { current: 0, best: 0 });
  assert.deepEqual(dayStreaks(log(['2026-11-24']), now), { current: 1, best: 1 });
  assert.deepEqual(dayStreaks(log(['2026-11-22', '2026-11-23', '2026-11-24']), now), { current: 3, best: 3 });
  // trained until yesterday, today still ahead: the streak is alive
  assert.deepEqual(dayStreaks(log(['2026-11-22', '2026-11-23']), now), { current: 2, best: 2 });
  // missed a whole day: the streak is gone but the best stays
  assert.deepEqual(dayStreaks(log(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-22']), now), { current: 0, best: 3 });
  // across a month and a year border
  assert.deepEqual(dayStreaks(log(['2025-12-31', '2026-01-01']), at(2026, 1, 1)), { current: 2, best: 2 });
});

test('formatTotalTime', () => {
  assert.equal(formatTotalTime(0), '0s');
  assert.equal(formatTotalTime(40_000), '40s');
  assert.equal(formatTotalTime(125_000), '2m 05s');
  assert.equal(formatTotalTime(5 * 3600_000 + 34 * 60_000 + 20_000), '5h 34m');
});
