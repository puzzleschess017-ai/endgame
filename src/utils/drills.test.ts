import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { Chess } from 'chess.js';
import {
  DRILL_KINDS,
  DRILLS_SETTINGS_STORAGE_KEY,
  drillAccuracy,
  drillLabel,
  givesCheck,
  isDrillKind,
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

// ---- Check or not ----

const LETTER = { knight: 'n', bishop: 'b', rook: 'r', queen: 'q', pawn: 'p' } as const;

/** Reference: chess.js says whether the attacker (alone, with the blockers) attacks the king's square. */
function referenceCheck(piece: keyof typeof LETTER, side: 'white' | 'black', from: string, king: string, blockers: string[]): boolean {
  const game = new Chess();
  game.clear();
  const attacker = side === 'white' ? 'w' : 'b';
  game.put({ type: LETTER[piece], color: attacker }, from as never);
  game.put({ type: 'k', color: attacker === 'w' ? 'b' : 'w' }, king as never);
  for (const b of blockers) game.put({ type: 'n', color: 'w' }, b as never);
  return game.attackers(king as never, attacker).includes(from as never);
}

test('givesCheck agrees with chess.js for every piece, colour, square pair and some blockers', () => {
  const squares: string[] = [];
  for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) squares.push(`${f}${r}`);
  const pieces = ['knight', 'bishop', 'rook', 'queen', 'pawn'] as const;
  let checked = 0;
  for (const piece of pieces) {
    for (const side of ['white', 'black'] as const) {
      for (const from of squares) {
        if (piece === 'pawn' && (from[1] === '1' || from[1] === '8')) continue;
        for (const king of squares) {
          if (king === from) continue;
          assert.equal(givesCheck(piece, side, from, king), referenceCheck(piece, side, from, king, []), `${side} ${piece} ${from} -> ${king}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 20000);
  // blockers: a piece on the line between stops a slider, one off the line does not
  for (let i = 0; i < 3000; i++) {
    const piece = (['bishop', 'rook', 'queen'] as const)[i % 3];
    const from = squares[(i * 7) % 64], king = squares[(i * 13 + 5) % 64], block = squares[(i * 29 + 3) % 64];
    if (new Set([from, king, block]).size < 3) continue;
    assert.equal(givesCheck(piece, 'white', from, king, [block]), referenceCheck(piece, 'white', from, king, [block]), `${piece} ${from} -> ${king} with ${block}`);
  }
});

test('givesCheck: pawns attack forward only, a king-less line is not check', () => {
  assert.equal(givesCheck('pawn', 'white', 'e4', 'd5'), true);
  assert.equal(givesCheck('pawn', 'white', 'e4', 'f5'), true);
  assert.equal(givesCheck('pawn', 'white', 'e4', 'e5'), false);
  assert.equal(givesCheck('pawn', 'white', 'e4', 'd3'), false);
  assert.equal(givesCheck('pawn', 'black', 'e5', 'd4'), true);
  assert.equal(givesCheck('pawn', 'black', 'e5', 'd6'), false);
  assert.equal(givesCheck('rook', 'white', 'a1', 'a8'), true);
  assert.equal(givesCheck('rook', 'white', 'a1', 'a8', ['a4']), false);
  assert.equal(givesCheck('rook', 'white', 'a1', 'b2'), false);
  assert.equal(givesCheck('bishop', 'white', 'c1', 'h6'), true);
  assert.equal(givesCheck('knight', 'white', 'b1', 'c3'), true);
  assert.equal(givesCheck('knight', 'white', 'b1', 'b3'), false);
  assert.equal(givesCheck('queen', 'white', 'd1', 'h5'), true);
  assert.equal(givesCheck('queen', 'white', 'd1', 'e3'), false);
});

test('Check or not: answers are right, about half are checks, questions are readable', () => {
  assert.ok(isDrillKind('check'));
  assert.equal(drillLabel('check'), 'Check or not');
  let yes = 0, blocked = 0, withBlocker = 0;
  const N = 1500;
  for (let i = 0; i < N; i++) {
    const q = makeQuestion('check');
    assert.equal(q.kind, 'check');
    assert.deepEqual(q.options.map((o) => o.value), ['yes', 'no']);
    const m = /^(White|Black) (knight|bishop|rook|queen|pawn) on ([a-h][1-8]), (white|black) king on ([a-h][1-8])((?:, (?:white|black) (?:pawn|knight|bishop|rook|queen) on [a-h][1-8])*)\. Is it check\?$/.exec(q.prompt);
    assert.ok(m, q.prompt);
    const [, color, piece, from, kingColor, king, rest] = m;
    assert.notEqual(color.toLowerCase(), kingColor, q.prompt);
    const blockers = [...rest.matchAll(/on ([a-h][1-8])/g)].map((x) => x[1]);
    assert.deepEqual(q.squares, [from, king, ...blockers]);
    assert.equal(new Set(q.squares).size, q.squares.length, `distinct squares: ${q.prompt}`);
    const expected = referenceCheck(piece as keyof typeof LETTER, color.toLowerCase() as 'white' | 'black', from, king, blockers);
    assert.equal(q.answer, expected ? 'yes' : 'no', q.prompt);
    assert.ok(q.explanation.startsWith(expected ? 'Yes' : 'No'), q.explanation);
    if (piece === 'pawn') assert.ok(from[1] !== '1' && from[1] !== '8');
    for (const b of rest.matchAll(/(pawn) on ([a-h][1-8])/g)) assert.ok(b[2][1] !== '1' && b[2][1] !== '8', q.prompt);
    if (expected) yes++;
    if (blockers.length > 0) withBlocker++;
    if (blockers.length > 0 && !expected && q.explanation.includes('in the way')) blocked++;
  }
  assert.ok(yes > N * 0.38 && yes < N * 0.62, `yes = ${yes}`);
  assert.ok(withBlocker > N * 0.1, `blockers ${withBlocker}`);
  assert.ok(blocked > N * 0.05, `blocked ${blocked}`);
});
