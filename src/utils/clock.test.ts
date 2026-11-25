import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatClock } from './clock.ts';

test('formatClock rounds up and never goes below 0:00', () => {
  assert.equal(formatClock(300_000), '5:00');
  assert.equal(formatClock(179_001), '3:00');
  assert.equal(formatClock(59_000), '0:59');
  assert.equal(formatClock(9_100), '0:10');
  assert.equal(formatClock(1), '0:01');
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(-5000), '0:00');
});
