import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Chess } from 'chess.js';
import {
  blindfoldPoolSizes,
  parseBlindfoldParams,
  pickBlindfoldPuzzles,
} from './blindfold.ts';

const db = new Database(path.join(import.meta.dirname, '..', 'endgame.db'), { readonly: true });

test('parseBlindfoldParams: defaults, valid values and rejections', () => {
  assert.deepEqual(parseBlindfoldParams({}), { maxPieces: 32, count: 10, mateIn: 1 });
  assert.deepEqual(parseBlindfoldParams({ maxPieces: '6', count: '5' }), { maxPieces: 6, count: 5, mateIn: 1 });
  assert.deepEqual(parseBlindfoldParams({ mateIn: '2' }), { maxPieces: 32, count: 10, mateIn: 2 });
  assert.deepEqual(parseBlindfoldParams({ mateIn: '3' }), { maxPieces: 32, count: 10, mateIn: 3 });
  assert.equal(parseBlindfoldParams({ mateIn: '4' }), null);
  assert.equal(parseBlindfoldParams({ mateIn: '0' }), null);
  assert.equal(parseBlindfoldParams({ mateIn: 'x' }), null);
  assert.equal(parseBlindfoldParams({ maxPieces: '9' }), null);
  assert.equal(parseBlindfoldParams({ maxPieces: 'abc' }), null);
  assert.equal(parseBlindfoldParams({ count: '0' }), null);
  assert.equal(parseBlindfoldParams({ count: '21' }), null);
  assert.equal(parseBlindfoldParams({ count: '2.5' }), null);
});

test('every level has plenty of puzzles and the levels are nested', () => {
  const sizes = blindfoldPoolSizes(db);
  assert.ok(sizes[6] >= 500, `level 6 has ${sizes[6]}`);
  assert.ok(sizes[6] <= sizes[7] && sizes[7] <= sizes[8] && sizes[8] <= sizes[10] && sizes[10] <= sizes[32]);
  assert.ok(sizes[7] >= 1000, `level 7 has ${sizes[7]}`);
});

for (const maxPieces of [6, 7, 8, 10, 32]) {
  test(`pickBlindfoldPuzzles: ${maxPieces} pieces gives distinct real mates in one`, () => {
    const puzzles = pickBlindfoldPuzzles(db, { maxPieces, count: 12 });
    assert.equal(puzzles.length, 12);
    assert.equal(new Set(puzzles.map((p) => p.puzzle_id)).size, 12);
    for (const p of puzzles) {
      const moves = p.moves.split(' ');
      assert.equal(moves.length, 2, `${p.puzzle_id} must have two plies`);
      const game = new Chess(p.fen);
      game.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: moves[0][4] });
      const pieces = game.fen().split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
      assert.ok(pieces <= maxPieces, `${p.puzzle_id} has ${pieces} pieces`);
      game.move({ from: moves[1].slice(0, 2), to: moves[1].slice(2, 4), promotion: moves[1][4] });
      assert.ok(game.isCheckmate(), `${p.puzzle_id} must end in checkmate`);
    }
  });
}

test('pickBlindfoldPuzzles is random and uses the given random source', () => {
  const a = pickBlindfoldPuzzles(db, { maxPieces: 8, count: 10 }, () => 0.1);
  const b = pickBlindfoldPuzzles(db, { maxPieces: 8, count: 10 }, () => 0.1);
  assert.deepEqual(a.map((p) => p.puzzle_id), b.map((p) => p.puzzle_id));
  const c = pickBlindfoldPuzzles(db, { maxPieces: 8, count: 10 });
  const d = pickBlindfoldPuzzles(db, { maxPieces: 8, count: 10 });
  assert.notDeepEqual(c.map((p) => p.puzzle_id), d.map((p) => p.puzzle_id));
});

for (const mateIn of [2, 3]) {
  test(`mate in ${mateIn}: every level has puzzles, nested, and each puzzle is a real forced line ending in mate`, () => {
    const sizes = blindfoldPoolSizes(db, mateIn);
    assert.ok(sizes[6] >= 15, `level 6 has ${sizes[6]}`);
    assert.ok(sizes[6] <= sizes[7] && sizes[7] <= sizes[8] && sizes[8] <= sizes[10] && sizes[10] <= sizes[32]);
    assert.ok(sizes[32] >= 2000, `any level has ${sizes[32]}`);
    for (const maxPieces of [6, 8, 32]) {
      const puzzles = pickBlindfoldPuzzles(db, { maxPieces, count: 10, mateIn });
      assert.equal(puzzles.length, 10, `${maxPieces} pieces`);
      assert.equal(new Set(puzzles.map((p) => p.puzzle_id)).size, 10);
      for (const p of puzzles) {
        const moves = p.moves.split(' ');
        assert.equal(moves.length, mateIn * 2, `${p.puzzle_id} must have ${mateIn * 2} plies`);
        assert.ok(` ${p.themes} `.includes(` mateIn${mateIn} `), `${p.puzzle_id} must be tagged mateIn${mateIn}`);
        const game = new Chess(p.fen);
        moves.forEach((m, i) => {
          game.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
          if (i === 0) {
            const pieces = game.fen().split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
            assert.ok(pieces <= maxPieces, `${p.puzzle_id} has ${pieces} pieces`);
          }
        });
        assert.ok(game.isCheckmate(), `${p.puzzle_id} must end in checkmate`);
      }
    }
  });
}

test('mate in 1 is unchanged when mateIn is missing or 1', () => {
  const a = pickBlindfoldPuzzles(db, { maxPieces: 8, count: 6 }, () => 0.3);
  const b = pickBlindfoldPuzzles(db, { maxPieces: 8, count: 6, mateIn: 1 }, () => 0.3);
  assert.deepEqual(a.map((p) => p.puzzle_id), b.map((p) => p.puzzle_id));
  assert.ok(a.every((p) => p.moves.split(' ').length === 2));
});
