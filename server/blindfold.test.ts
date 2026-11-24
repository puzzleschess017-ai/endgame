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
  assert.deepEqual(parseBlindfoldParams({}), { maxPieces: 32, count: 10 });
  assert.deepEqual(parseBlindfoldParams({ maxPieces: '6', count: '5' }), { maxPieces: 6, count: 5 });
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
