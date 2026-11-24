// Run with: npx tsx --test src/utils/ladderFeed.test.ts src/utils/streak.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LADDER_MAX_START, LadderFeed, type LadderBatchRequest } from './ladderFeed.ts';
import type { Puzzle } from '../types.ts';

function puzzle(id: string, rating: number): Puzzle {
  return { puzzleId: id, fen: '', moves: ['a1a2', 'b1b2'], rating, ratingDeviation: 75, popularity: 100, themes: [], numMoves: 1 };
}

/** Fake server: puzzle ids and ratings follow the requested rungs. */
function fakeFetch(log: LadderBatchRequest[], maxRating = Infinity) {
  return async (request: LadderBatchRequest): Promise<Puzzle[]> => {
    log.push(request);
    const out: Puzzle[] = [];
    for (let i = 0; i < request.count; i++) {
      const rating = request.start + i * request.step;
      if (rating <= maxRating) out.push(puzzle(`p${rating}`, rating));
    }
    return out;
  };
}

test('puzzles come out in the order they were built, easy to hard', async () => {
  const log: LadderBatchRequest[] = [];
  const feed = new LadderFeed({ start: 500, step: 40, batchSize: 5, prefetchBelow: 0, fetchBatch: fakeFetch(log) });
  const ratings: number[] = [];
  for (let i = 0; i < 12; i++) ratings.push((await feed.next())!.rating);
  assert.deepEqual(ratings, [500, 540, 580, 620, 660, 700, 740, 780, 820, 860, 900, 940]);
  assert.deepEqual(log.map((r) => r.start).slice(0, 3), [500, 700, 900]);
});

test('the next batch is requested before the queue runs dry', async () => {
  const log: LadderBatchRequest[] = [];
  const feed = new LadderFeed({ start: 500, step: 40, batchSize: 10, prefetchBelow: 4, fetchBatch: fakeFetch(log) });
  await feed.prepare();
  assert.equal(log.length, 1);
  for (let i = 0; i < 6; i++) await feed.next(); // 4 left -> prefetch
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(log.length, 2);
  assert.equal(log[1].start, 900);
  assert.ok(feed.remaining >= 10);
});

test('two requests at once share one fetch', async () => {
  const log: LadderBatchRequest[] = [];
  const feed = new LadderFeed({ start: 500, step: 40, batchSize: 5, fetchBatch: fakeFetch(log) });
  await Promise.all([feed.prepare(), feed.prepare()]);
  assert.equal(log.length, 1);
});

test('a puzzle that comes twice is only served once', async () => {
  let call = 0;
  const feed = new LadderFeed({
    start: 500, step: 40, batchSize: 3, prefetchBelow: 0,
    fetchBatch: async () => (++call === 1 ? [puzzle('a', 500), puzzle('b', 540), puzzle('c', 580)] : [puzzle('c', 580), puzzle('d', 620), puzzle('e', 660)]),
  });
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) ids.push((await feed.next())!.puzzleId);
  assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'e']);
});

test('returns null when the ladder has no more puzzles', async () => {
  const log: LadderBatchRequest[] = [];
  const feed = new LadderFeed({ start: 3100, step: 40, batchSize: 3, prefetchBelow: 0, fetchBatch: fakeFetch(log, 3200) });
  const got: string[] = [];
  for (let i = 0; i < 20; i++) {
    const next = await feed.next();
    if (!next) break;
    got.push(next.puzzleId);
  }
  assert.ok(got.length >= 3 && got.length < 20, `ended after ${got.length} puzzles`);
  assert.deepEqual(got.slice(0, 3), ['p3100', 'p3140', 'p3180']);
  assert.equal(new Set(got).size, got.length);
  assert.equal(await feed.next(), null);
  assert.ok(log.every((r) => r.start <= LADDER_MAX_START));
  const calls = log.length;
  await feed.next();
  assert.equal(log.length, calls, 'no more requests once exhausted');
});

test('a failed request throws when the queue is empty and can be retried', async () => {
  let fail = true;
  const feed = new LadderFeed({
    start: 500, step: 40, batchSize: 2, prefetchBelow: 0,
    fetchBatch: async () => { if (fail) throw new Error('offline'); return [puzzle('x', 500), puzzle('y', 540)]; },
  });
  await assert.rejects(() => feed.next(), /offline/);
  fail = false;
  assert.equal((await feed.next())!.puzzleId, 'x');
});

test('a failed prefetch does not break the puzzles already in the queue', async () => {
  let call = 0;
  const feed = new LadderFeed({
    start: 500, step: 40, batchSize: 3, prefetchBelow: 5,
    fetchBatch: async () => { if (++call === 1) return [puzzle('a', 500), puzzle('b', 540), puzzle('c', 580)]; throw new Error('offline'); },
  });
  assert.equal((await feed.next())!.puzzleId, 'a');
  assert.equal((await feed.next())!.puzzleId, 'b');
  assert.equal((await feed.next())!.puzzleId, 'c');
});
