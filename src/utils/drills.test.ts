import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  DRILL_KINDS,
  DRILLS_SETTINGS_STORAGE_KEY,
  drillAccuracy,
  isLightSquare,
  knightDistance,
  loadDrillBest,
  loadDrillKind,
  makeQuestion,
  onSameDiagonal,
  saveDrillBest,
  saveDrillKind,
} from './drills.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => store.clear());

test('square colors: a1 dark, h1 light, a8 light, h8 dark', () => {
  assert.equal(isLightSquare('a1'), false);
  assert.equal(isLightSquare('h1'), true);
  assert.equal(isLightSquare('a8'), true);
  assert.equal(isLightSquare('h8'), false);
  assert.equal(isLightSquare('e4'), true);
  assert.equal(isLightSquare('d4'), false);
  let light = 0;
  for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) if (isLightSquare(`${f}${r}`)) light++;
  assert.equal(light, 32);
});

test('same diagonal', () => {
  assert.equal(onSameDiagonal('a1', 'h8'), true);
  assert.equal(onSameDiagonal('c1', 'h6'), true);
  assert.equal(onSameDiagonal('a1', 'a8'), false);
  assert.equal(onSameDiagonal('b1', 'c3'), false);
  assert.equal(onSameDiagonal('e4', 'e4'), false);
  assert.equal(onSameDiagonal('d4', 'a7'), true);
});

test('knight distance', () => {
  assert.equal(knightDistance('b1', 'b1'), 0);
  assert.equal(knightDistance('b1', 'c3'), 1);
  assert.equal(knightDistance('g1', 'f3'), 1);
  assert.equal(knightDistance('a1', 'b2'), 4);
  assert.equal(knightDistance('a1', 'h8'), 6);
  assert.equal(knightDistance('e4', 'e5'), 3);
  let max = 0;
  for (const a of ['a1', 'a8', 'h1', 'h8', 'd4', 'b2', 'g7']) {
    for (const f of 'abcdefgh') {
      for (let r = 1; r <= 8; r++) {
        const d = knightDistance(a, `${f}${r}`);
        assert.ok(d >= 0 && d <= 6, `${a}-${f}${r} = ${d}`);
        max = Math.max(max, d);
      }
    }
  }
  assert.equal(max, 6);
});

test('questions are well formed and the answer is one of the options', () => {
  for (const kind of DRILL_KINDS) {
    for (let i = 0; i < 300; i++) {
      const q = makeQuestion(kind);
      assert.equal(q.kind, kind);
      assert.ok(q.options.some((o) => o.value === q.answer), `${q.prompt} -> ${q.answer}`);
      assert.ok(q.explanation.length > 0);
      assert.equal(new Set(q.options.map((o) => o.key)).size, q.options.length);
      if (kind !== 'color') assert.notEqual(q.squares[0], q.squares[1]);
    }
  }
});

test('diagonal questions are about half yes, half no; knight answers are correct', () => {
  let yes = 0;
  for (let i = 0; i < 400; i++) {
    const q = makeQuestion('diagonal');
    assert.equal(q.answer === 'yes', onSameDiagonal(q.squares[0], q.squares[1]));
    if (q.answer === 'yes') yes++;
  }
  assert.ok(yes > 140 && yes < 260, `yes = ${yes}`);
  for (let i = 0; i < 100; i++) {
    const q = makeQuestion('knight');
    assert.equal(q.answer, String(knightDistance(q.squares[0], q.squares[1])));
  }
  for (let i = 0; i < 100; i++) {
    const q = makeQuestion('color');
    assert.equal(q.answer === 'light', isLightSquare(q.squares[0]));
  }
});

test('the same question never comes twice in a row', () => {
  let previous = makeQuestion('color');
  for (let i = 0; i < 300; i++) {
    const next = makeQuestion('color', Math.random, previous);
    assert.notEqual(next.prompt, previous.prompt);
    previous = next;
  }
});

test('accuracy', () => {
  assert.equal(drillAccuracy(0, 0), 0);
  assert.equal(drillAccuracy(3, 1), 75);
  assert.equal(drillAccuracy(1, 2), 33);
});

test('saved drill and best scores', () => {
  assert.equal(loadDrillKind(), 'color');
  saveDrillKind('knight');
  assert.equal(loadDrillKind(), 'knight');
  store.set(DRILLS_SETTINGS_STORAGE_KEY, '{"kind":"zzz"}');
  assert.equal(loadDrillKind(), 'color');
  assert.equal(loadDrillBest('color'), 0);
  assert.deepEqual(saveDrillBest('color', 0), { best: 0, isNewBest: false });
  assert.deepEqual(saveDrillBest('color', 20), { best: 20, isNewBest: true });
  assert.deepEqual(saveDrillBest('color', 19), { best: 20, isNewBest: false });
  assert.deepEqual(saveDrillBest('knight', 5), { best: 5, isNewBest: true });
  assert.equal(loadDrillBest('color'), 20);
});
