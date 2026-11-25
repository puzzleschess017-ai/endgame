import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REVIEW_CYCLES, reviewPuzzles, reviewSession, selectReview, trimOldAttempts } from './review.ts';
import type { Puzzle, PuzzleAttempt } from '../types';

const a = (id: string, failed: boolean, ms: number): PuzzleAttempt => ({ id, failed, ms });
const puzzle = (id: string): Puzzle => ({ puzzleId: id, fen: '8/8/8/8/8/8/8/K6k w - - 0 1', moves: ['a1a2', 'h1h2'], rating: 1000, ratingDeviation: 50, popularity: 90, themes: [], numMoves: 1 });

test('every missed puzzle comes first (slowest first), then the slowest solved ones up to five', () => {
  const attempts = [a('p1', false, 3000), a('p2', true, 9000), a('p3', false, 12000), a('p4', true, 15000), a('p5', false, 2000), a('p6', false, 8000), a('p7', false, 11000)];
  const r = selectReview(attempts);
  assert.deepEqual(r.items.map((i) => i.id), ['p4', 'p2', 'p3', 'p7', 'p6']);
  assert.deepEqual(r.items.map((i) => i.reason), ['missed', 'missed', 'slow', 'slow', 'slow']);
  assert.equal(r.missed, 2);
  assert.equal(r.slow, 3);
});

test('all missed puzzles are offered even when there are more than five', () => {
  const attempts = Array.from({ length: 8 }, (_, i) => a(`m${i}`, true, 1000 + i));
  attempts.push(a('ok', false, 99999));
  const r = selectReview(attempts);
  assert.equal(r.items.length, 8);
  assert.equal(r.slow, 0);
  assert.ok(!r.items.some((i) => i.id === 'ok'));
});

test('a perfect cycle still offers the five slowest', () => {
  const attempts = Array.from({ length: 10 }, (_, i) => a(`s${i}`, false, (i + 1) * 1000));
  const r = selectReview(attempts);
  assert.deepEqual(r.items.map((i) => i.id), ['s9', 's8', 's7', 's6', 's5']);
  assert.equal(r.missed, 0);
});

test('a short cycle offers what it has; nothing recorded offers nothing', () => {
  assert.equal(selectReview([a('x', false, 100), a('y', false, 200)]).items.length, 2);
  assert.equal(selectReview(undefined).items.length, 0);
  assert.equal(selectReview([]).items.length, 0);
});

test('the review puzzles keep the order of the original set', () => {
  const set = ['a', 'b', 'c', 'd', 'e'].map(puzzle);
  const picked = reviewPuzzles(set, [{ id: 'd', reason: 'missed', ms: 1 }, { id: 'b', reason: 'slow', ms: 2 }]);
  assert.deepEqual(picked.map((p) => p.puzzleId), ['b', 'd']);
});

test('a review session is a fresh two-cycle run of only those puzzles', () => {
  const set = ['a', 'b', 'c'].map(puzzle);
  const s = reviewSession({ config: { puzzleCount: 50, totalCycles: 4, difficulty: 'easy', puzzleMode: 'classic' }, puzzles: set }, [{ id: 'c', reason: 'missed', ms: 5 }], 'new-id');
  assert.equal(s.id, 'new-id');
  assert.equal(s.puzzles.length, 1);
  assert.equal(s.config.totalCycles, REVIEW_CYCLES);
  assert.equal(s.config.puzzleCount, 1);
  assert.equal(s.config.puzzleMode, 'classic');
  assert.equal(s.review, true);
  assert.equal(s.status, 'training');
  assert.deepEqual(s.cycleResults, []);
});

test('only the latest result keeps its attempts', () => {
  const r = (n: number) => ({ cycleNumber: n, attempts: [a('x', false, 1)] });
  const trimmed = trimOldAttempts([r(1), r(2), r(3)]);
  assert.equal(trimmed[0].attempts, undefined);
  assert.equal(trimmed[1].attempts, undefined);
  assert.equal(trimmed[2].attempts?.length, 1);
});
