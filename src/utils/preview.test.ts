import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { PREVIEW_FENS, randomPreviewFen } from './preview.ts';

test('every waiting position is an ordinary position that is not over', () => {
  assert.ok(PREVIEW_FENS.length >= 10);
  assert.equal(new Set(PREVIEW_FENS).size, PREVIEW_FENS.length);
  for (const fen of PREVIEW_FENS) {
    const chess = new Chess(fen);
    assert.equal(chess.isGameOver(), false, fen);
    assert.equal(chess.inCheck(), false, fen);
    assert.ok(chess.moves().length > 0, fen);
  }
});

test('the position changes: it is one of the list, and not the one just shown', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const fen = randomPreviewFen();
    assert.ok(PREVIEW_FENS.includes(fen));
    seen.add(fen);
    assert.notEqual(randomPreviewFen(fen), fen);
  }
  assert.ok(seen.size > 5);
});
