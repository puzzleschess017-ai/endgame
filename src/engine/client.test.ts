import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UciEngine, type SearchUpdate } from './client.ts';
import { createFakeEngine } from './fakeEngine.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const finished = (engine: UciEngine, fen: string, depth: number) =>
  new Promise<SearchUpdate[]>((resolve) => {
    const updates: SearchUpdate[] = [];
    engine.analyse(fen, depth, (u) => {
      updates.push(u);
      if (u.done) resolve(updates);
    });
  });

test('starts the engine in the right order and asks for three lines', async () => {
  const fake = createFakeEngine();
  const engine = new UciEngine(async () => fake, 3);
  await engine.start();
  assert.deepEqual(fake.log.slice(0, 3), ['uci', 'setoption name MultiPV value 3', 'isready']);
  engine.dispose();
});

test('a search reports deeper and deeper lines and ends with done', async () => {
  const fake = createFakeEngine();
  const engine = new UciEngine(async () => fake, 3);
  await engine.start();
  const updates = await finished(engine, START, 4);
  assert.ok(fake.log.includes(`position fen ${START}`));
  assert.ok(fake.log.includes('go depth 4'));
  const last = updates[updates.length - 1];
  assert.equal(last.done, true);
  assert.equal(last.depth, 4);
  assert.deepEqual(last.lines.map((l) => l.multipv), [1, 2, 3]);
  assert.ok(last.lines.every((l) => l.depth === 4));
  // depths never go back
  const depths = updates.map((u) => u.depth);
  assert.deepEqual([...depths].sort((a, b) => a - b), depths);
  engine.dispose();
});

test('a new position stops the old search and nothing of the old one is reported afterwards', async () => {
  const fake = createFakeEngine({ stepMs: 20 });
  const engine = new UciEngine(async () => fake, 3);
  await engine.start();
  const oldUpdates: SearchUpdate[] = [];
  engine.analyse(START, 30, (u) => oldUpdates.push(u));
  await new Promise((r) => setTimeout(r, 70));
  const before = oldUpdates.length;
  const updates = await finished(engine, AFTER_E4, 3);
  assert.ok(fake.log.includes('stop'));
  assert.ok(oldUpdates.length - before <= 1, 'the old search kept talking');
  assert.ok(oldUpdates.every((u) => !u.done), 'a stopped search must not be reported as finished');
  assert.equal(updates[updates.length - 1].lines[0].pv[0], 'e7e5');
  engine.dispose();
});

test('only the last of several quick requests is searched', async () => {
  const fake = createFakeEngine({ stepMs: 15 });
  const engine = new UciEngine(async () => fake, 1);
  await engine.start();
  engine.analyse(START, 30, () => {});
  engine.analyse('8/8/8/8/8/8/8/K6k w - - 0 1', 30, () => {});
  const updates = await finished(engine, AFTER_E4, 2);
  const positions = fake.log.filter((m) => m.startsWith('position fen '));
  assert.equal(positions.length, 2);
  assert.equal(positions[1], `position fen ${AFTER_E4}`);
  assert.equal(updates[updates.length - 1].done, true);
  engine.dispose();
});

test('stop ends the search without reporting it as finished', async () => {
  const fake = createFakeEngine({ stepMs: 10 });
  const engine = new UciEngine(async () => fake, 1);
  await engine.start();
  const seen: SearchUpdate[] = [];
  engine.analyse(START, 40, (u) => seen.push(u));
  await new Promise((r) => setTimeout(r, 40));
  engine.stop();
  await new Promise((r) => setTimeout(r, 60));
  assert.ok(seen.every((u) => !u.done));
  const count = seen.length;
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(seen.length, count);
  engine.dispose();
});

test('a failing factory rejects start and can be tried again', async () => {
  let calls = 0;
  const engine = new UciEngine(async () => {
    calls += 1;
    if (calls === 1) throw new Error('no engine');
    return createFakeEngine();
  });
  await assert.rejects(engine.start(), /no engine/);
  await engine.start();
  assert.equal(calls, 2);
  engine.dispose();
});

test('after dispose nothing is searched', async () => {
  const fake = createFakeEngine();
  const engine = new UciEngine(async () => fake);
  await engine.start();
  engine.dispose();
  engine.analyse(START, 5, () => assert.fail('searched after dispose'));
  await new Promise((r) => setTimeout(r, 30));
});
