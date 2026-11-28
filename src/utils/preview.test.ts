import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { PREVIEW_BY_MODE, previewFen, type PreviewMode } from './preview.ts';

const MODES = Object.keys(PREVIEW_BY_MODE) as PreviewMode[];

test('every waiting position is an ordinary position that is not over', () => {
  assert.equal(MODES.length, 3);
  for (const mode of MODES) {
    const chess = new Chess(PREVIEW_BY_MODE[mode]);
    assert.equal(chess.isGameOver(), false, mode);
    assert.equal(chess.inCheck(), false, mode);
    assert.ok(chess.moves().length > 0, mode);
  }
});

test('the three modes have three different positions, and each one stays the same', () => {
  assert.equal(new Set(MODES.map((m) => previewFen(m))).size, 3);
  for (const mode of MODES) assert.equal(previewFen(mode), previewFen(mode));
});
