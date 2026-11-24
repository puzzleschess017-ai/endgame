import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RATING_BANDS, parseSampleQuery, splitMixedCount } from './woodpecker.ts';

const total = (split: Record<string, number>) => Object.values(split).reduce((a, b) => a + b, 0);

test('splitMixedCount adds up to the count and is even to within one puzzle', () => {
  for (const count of [10, 50, 100, 200]) {
    for (let run = 0; run < 50; run++) {
      const split = splitMixedCount(count);
      assert.equal(total(split), count);
      const values = RATING_BANDS.map((b) => split[b]);
      assert.ok(Math.max(...values) - Math.min(...values) <= 1, JSON.stringify(split));
    }
  }
});

test('splitMixedCount divides evenly when it can', () => {
  assert.deepEqual(splitMixedCount(100), { easy: 25, medium: 25, hard: 25, expert: 25 });
  assert.deepEqual(splitMixedCount(200), { easy: 50, medium: 50, hard: 50, expert: 50 });
});

test('splitMixedCount gives the extra puzzles to different bands, not always the same two', () => {
  const extras = new Set<string>();
  for (let run = 0; run < 200; run++) {
    const split = splitMixedCount(10);
    for (const band of RATING_BANDS) if (split[band] === 3) extras.add(band);
  }
  assert.equal(extras.size, RATING_BANDS.length);
});

test('splitMixedCount follows the random numbers it is given', () => {
  assert.deepEqual(splitMixedCount(10, () => 0), { easy: 2, medium: 3, hard: 3, expert: 2 });
});

test('parseSampleQuery accepts every difficulty including mixed, in any letter case', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert', 'mixed', 'MIXED', 'Mixed']) {
    const parsed = parseSampleQuery({ count: '50', difficulty });
    assert.ok(parsed.ok, difficulty);
    if (parsed.ok) assert.equal(parsed.difficulty, difficulty.toLowerCase());
  }
});

test('parseSampleQuery rejects bad counts and difficulties', () => {
  for (const count of ['', '0', '25', 'abc', '10.5', undefined]) {
    assert.equal(parseSampleQuery({ count, difficulty: 'easy' }).ok, false, String(count));
  }
  for (const difficulty of ['', 'impossible', 'all', undefined, 5]) {
    assert.equal(parseSampleQuery({ count: '10', difficulty }).ok, false, String(difficulty));
  }
});
