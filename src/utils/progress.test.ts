import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accuracyAxis, groupSets, setIdOf, speedSummary } from './progress.ts';
import type { WoodpeckerCycleRecord } from './woodpeckerHistory.ts';

const rec = (session: string, cycle: number, correct: number, incorrect: number, timeMs: number, at: number, count = 50): WoodpeckerCycleRecord => ({
  key: `${session}:${cycle}`,
  completedAt: at,
  correct,
  incorrect,
  accuracy: (correct / (correct + incorrect)) * 100,
  timeMs,
  puzzleCount: count,
  difficulty: 'medium',
});

test('the set id is the part of the key before the cycle number', () => {
  assert.equal(setIdOf('3f2a-11-ee:2'), '3f2a-11-ee');
  assert.equal(setIdOf('old'), 'old');
});

test('cycles are grouped by set and ordered, the most recent set first', () => {
  const history = [
    rec('A', 2, 45, 5, 500_000, 2000),
    rec('B', 1, 30, 20, 900_000, 5000),
    rec('A', 1, 40, 10, 800_000, 1000),
    rec('A', 3, 50, 0, 400_000, 3000),
  ];
  const sets = groupSets(history);
  assert.deepEqual(sets.map((s) => s.id), ['B', 'A']);
  assert.deepEqual(sets[1].cycles.map((c) => c.cycle), [1, 2, 3]);
  assert.equal(sets[1].completedAt, 3000);
  assert.equal(sets[1].cycles[0].seconds, 16); // 800 s over 50 puzzles
  assert.equal(sets[1].cycles[2].accuracy, 100);
  assert.equal(sets[1].cycles[0].solved, 40);
  assert.equal(sets[1].cycles[0].total, 50);
});

test('records without puzzles are skipped and an empty history gives no sets', () => {
  assert.deepEqual(groupSets([]), []);
  assert.deepEqual(groupSets([rec('Z', 1, 0, 0, 1000, 1)]), []);
});

test('speed summary compares the last cycle with the first', () => {
  const faster = groupSets([rec('A', 1, 40, 10, 800_000, 1), rec('A', 2, 50, 0, 496_000, 2)])[0];
  assert.equal(speedSummary(faster), 'Cycle 2 is 38% faster than cycle 1');
  const slower = groupSets([rec('A', 1, 40, 10, 400_000, 1), rec('A', 2, 40, 10, 600_000, 2)])[0];
  assert.equal(speedSummary(slower), 'Cycle 2 is 50% slower than cycle 1');
  const same = groupSets([rec('A', 1, 40, 10, 400_000, 1), rec('A', 2, 40, 10, 401_000, 2)])[0];
  assert.match(speedSummary(same)!, /about as long/);
  assert.equal(speedSummary(groupSets([rec('A', 1, 40, 10, 400_000, 1)])[0]), null);
});

test('the accuracy axis starts at a round number under the lowest value', () => {
  assert.deepEqual(accuracyAxis([92, 96, 100]), { min: 80, max: 100 });
  assert.deepEqual(accuracyAxis([60, 80]), { min: 50, max: 100 });
  assert.deepEqual(accuracyAxis([3]), { min: 0, max: 100 });
  assert.deepEqual(accuracyAxis([]), { min: 0, max: 100 });
});
