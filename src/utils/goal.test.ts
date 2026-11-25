import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ActivityLog } from './activity.ts';
import { DEFAULT_GOAL, goalProgress, goalStreak, parseGoal } from './goal.ts';

// Noon on 2026-11-25 (local time), so the day keys are the same in every time zone.
const NOW = new Date(2026, 10, 25, 12).getTime();
const day = (key: string, puzzles: number) => ({ [key]: { sessions: 1, ms: 1000, puzzles, correct: puzzles, wrong: 0 } });
const log = (...parts: ActivityLog[]): ActivityLog => Object.assign({}, ...parts);

test('a saved goal must be a whole number from 1 to 1000', () => {
  assert.equal(parseGoal('30'), 30);
  assert.equal(parseGoal('1'), 1);
  assert.equal(parseGoal('1000'), 1000);
  for (const bad of [null, '', '0', '-5', '1001', 'abc', '12.5', '20 ', 'NaN', '99999']) {
    if (bad === '20 ') assert.equal(parseGoal(bad), 20); // spaces around a number are fine
    else assert.equal(parseGoal(bad), DEFAULT_GOAL, String(bad));
  }
});

test('today\'s progress counts only today and stops at 100 per cent', () => {
  const l = log(day('2026-11-25', 12), day('2026-11-24', 50));
  assert.deepEqual(goalProgress(l, 20, NOW), { today: 12, goal: 20, percent: 60, reached: false });
  assert.deepEqual(goalProgress(log(day('2026-11-25', 45)), 20, NOW), { today: 45, goal: 20, percent: 100, reached: true });
  assert.deepEqual(goalProgress({}, 20, NOW), { today: 0, goal: 20, percent: 0, reached: false });
  assert.equal(goalProgress(log(day('2026-11-25', 20)), 20, NOW).reached, true);
});

test('the goal streak counts days in a row on which the goal was reached', () => {
  const l = log(day('2026-11-25', 25), day('2026-11-24', 22), day('2026-11-23', 10), day('2026-11-22', 30), day('2026-11-21', 30), day('2026-11-20', 30));
  assert.deepEqual(goalStreak(l, 20, NOW), { current: 2, best: 3 });
  // a lower goal bridges the day with 10
  assert.deepEqual(goalStreak(l, 10, NOW), { current: 6, best: 6 });
});

test('the streak is kept while today is still ahead, and ends after a missed day', () => {
  const l = log(day('2026-11-24', 30), day('2026-11-23', 30));
  assert.deepEqual(goalStreak(l, 20, NOW), { current: 2, best: 2 }); // today not done yet
  const missed = log(day('2026-11-23', 30), day('2026-11-22', 30));
  assert.equal(goalStreak(missed, 20, NOW).current, 0);
  assert.equal(goalStreak(missed, 20, NOW).best, 2);
  assert.deepEqual(goalStreak({}, 20, NOW), { current: 0, best: 0 });
  // today below the goal does not break yesterday's streak
  assert.equal(goalStreak(log(day('2026-11-25', 5), day('2026-11-24', 30)), 20, NOW).current, 1);
});

test('streaks work across a month and a year change', () => {
  const l = log(day('2027-01-01', 20), day('2026-12-31', 20), day('2026-12-30', 20));
  const now = new Date(2027, 0, 1, 12).getTime();
  assert.deepEqual(goalStreak(l, 20, now), { current: 3, best: 3 });
});
