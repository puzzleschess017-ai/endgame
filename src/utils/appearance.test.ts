import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOARD_SIZES,
  BOARD_SIZE_CLASS_MAP,
  DEFAULT_BOARD_SIZE,
  boardSizeClassFor,
  stepBoardSize,
} from './appearance.ts';

test('stepBoardSize goes one step up and down the list', () => {
  assert.equal(stepBoardSize(560, 1), 600);
  assert.equal(stepBoardSize(560, -1), 520);
  assert.equal(stepBoardSize(320, 1), 360);
});

test('stepBoardSize stays put at both ends', () => {
  assert.equal(stepBoardSize(BOARD_SIZES[0], -1), BOARD_SIZES[0]);
  assert.equal(stepBoardSize(BOARD_SIZES[BOARD_SIZES.length - 1], 1), BOARD_SIZES[BOARD_SIZES.length - 1]);
});

test('stepBoardSize starts from the nearest known size', () => {
  assert.equal(stepBoardSize(562, 1), 600);
  assert.equal(stepBoardSize(100, 1), 360);
  assert.equal(stepBoardSize(5000, -1), 720);
});

test('every size has a width class and unknown sizes fall back to the default', () => {
  for (const size of BOARD_SIZES) assert.ok(BOARD_SIZE_CLASS_MAP[size]);
  assert.equal(boardSizeClassFor(480), BOARD_SIZE_CLASS_MAP[480]);
  assert.equal(boardSizeClassFor(123), BOARD_SIZE_CLASS_MAP[DEFAULT_BOARD_SIZE]);
});
