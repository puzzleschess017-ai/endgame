import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeFen, piecesFromFen } from './DiagramBoard.tsx';

test('reads the pieces of a FEN with their squares', () => {
  const pieces = piecesFromFen('3K4/3P1k2/8/8/8/8/r7/4R3 w - - 0 1');
  assert.deepEqual(
    pieces.map((p) => `${p.code}${p.square}`).sort(),
    ['bKf7', 'bRa2', 'wKd8', 'wPd7', 'wRe1'],
  );
});

test('garbage gives no pieces and no crash', () => {
  assert.deepEqual(piecesFromFen(''), []);
  assert.deepEqual(piecesFromFen('xx/yy'), []);
  assert.deepEqual(piecesFromFen('9/9'), []);
});

test('describes the position for screen readers', () => {
  assert.equal(
    describeFen('7k/8/6K1/8/8/8/8/R7 b - - 0 1'),
    'White: king g6, rook a1. Black: king h8. Black to move.',
  );
});
