import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMPTY_PLACEMENT,
  START_FEN,
  START_PLACEMENT,
  buildFen,
  emptyPosition,
  enPassantSquare,
  parseFen,
  possibleCastling,
  startPosition,
  validateFen,
} from './editor.ts';

test('the start position builds the standard start FEN', () => {
  assert.equal(buildFen(startPosition()), START_FEN);
});

test('an empty board builds an empty FEN with no castling', () => {
  assert.equal(buildFen(emptyPosition()), `${EMPTY_PLACEMENT} w - - 0 1`);
});

test('castling rights are dropped when the king or rook is not on its home square', () => {
  const all = { K: true, Q: true, k: true, q: true };
  assert.deepEqual(possibleCastling(START_PLACEMENT, all), all);
  // White rook h1 moved to h2, black king moved to d8.
  assert.deepEqual(possibleCastling('r2k3r/pppppppp/8/8/8/8/PPPPPPPR/RNBQK3', all), { K: false, Q: true, k: false, q: false });
  assert.deepEqual(possibleCastling(EMPTY_PLACEMENT, all), { K: false, Q: false, k: false, q: false });
  // Rights nobody asked for stay off.
  assert.deepEqual(possibleCastling(START_PLACEMENT, { K: true, Q: false, k: false, q: false }), { K: true, Q: false, k: false, q: false });
});

test('buildFen writes only the castling rights that are possible', () => {
  const fen = buildFen({ ...startPosition(), placement: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQK2R' });
  assert.equal(fen, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQK2R w Kkq - 0 1');
});

test('en passant square: needs the pawn that just moved and empty squares behind it', () => {
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR';
  assert.equal(enPassantSquare(afterE4, 'b', 'e'), 'e3');
  assert.equal(enPassantSquare(afterE4, 'b', 'd'), '-');
  assert.equal(enPassantSquare(afterE4, 'b', null), '-');
  assert.equal(enPassantSquare(afterE4, 'w', 'e'), '-');
  const afterD5 = 'rnbqkbnr/ppp1pppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR';
  assert.equal(enPassantSquare(afterD5, 'w', 'd'), 'd6');
  // A piece on the square behind the pawn means it could not have just moved there.
  assert.equal(enPassantSquare('rnbqkbnr/ppp1pppp/3N4/3p4/8/8/PPPPPPPP/R1BQKBNR', 'w', 'd'), '-');
});

test('parseFen reads every field and fills in missing ones', () => {
  const parsed = parseFen('4k3/8/8/8/4Pp2/8/8/4K2R b K e3 7 22');
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.position.turn, 'b');
    assert.deepEqual(parsed.position.castling, { K: true, Q: false, k: false, q: false });
    assert.equal(parsed.position.ep, 'e');
    assert.equal(parsed.position.halfmove, 7);
    assert.equal(parsed.position.fullmove, 22);
  }
  const short = parseFen('8/8/8/8/8/8/8/8');
  assert.ok(short.ok);
  if (short.ok) assert.deepEqual([short.position.turn, short.position.fullmove, short.position.ep], ['w', 1, null]);
});

test('parseFen explains what is wrong', () => {
  for (const bad of ['', 'hello', '8/8/8/8/8/8/8 w - - 0 1', '9/8/8/8/8/8/8/8 w', '8/8/8/8/8/8/8/8 x - - 0 1', '8/8/8/8/8/8/8/8 w ZZ - 0 1', '8/8/8/8/8/8/8/8 w - e5 0 1', '8/8/8/8/8/8/8/8 w - - x 1']) {
    const parsed = parseFen(bad);
    assert.equal(parsed.ok, false, bad);
    if (!parsed.ok) assert.ok(parsed.error.length > 5);
  }
});

test('buildFen and parseFen agree', () => {
  const fen = 'r3k2r/pp3ppp/2n5/3pP3/8/2N5/PP3PPP/R3K2R w KQkq d6 3 15';
  const parsed = parseFen(fen);
  assert.ok(parsed.ok);
  if (parsed.ok) assert.equal(buildFen(parsed.position), fen);
});

test('validateFen: legal positions pass', () => {
  assert.deepEqual(validateFen(START_FEN), { ok: true });
  assert.deepEqual(validateFen('8/8/8/8/8/5k2/p7/7K w - - 0 1'), { ok: true });
});

test('validateFen: kings', () => {
  assert.deepEqual(validateFen(`${EMPTY_PLACEMENT} w - - 0 1`), { ok: false, reason: 'White needs a king.' });
  assert.deepEqual(validateFen('4k3/8/8/8/8/8/8/8 w - - 0 1'), { ok: false, reason: 'White needs a king.' });
  assert.deepEqual(validateFen('8/8/8/8/8/8/8/4K3 w - - 0 1'), { ok: false, reason: 'Black needs a king.' });
  assert.deepEqual(validateFen('4k3/8/8/8/8/8/8/3KK3 w - - 0 1'), { ok: false, reason: 'White can only have one king.' });
  assert.deepEqual(validateFen('3kk3/8/8/8/8/8/8/4K3 w - - 0 1'), { ok: false, reason: 'Black can only have one king.' });
});

test('validateFen: pawns on the first or last rank', () => {
  assert.deepEqual(validateFen('P3k3/8/8/8/8/8/8/4K3 w - - 0 1'), { ok: false, reason: 'Pawns cannot stand on the first or last rank.' });
  assert.deepEqual(validateFen('4k3/8/8/8/8/8/8/p3K3 w - - 0 1'), { ok: false, reason: 'Pawns cannot stand on the first or last rank.' });
});

test('validateFen: the side that is not to move cannot be in check', () => {
  assert.deepEqual(validateFen('4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'), { ok: false, reason: 'Black is in check but it is not their turn.' });
  assert.deepEqual(validateFen('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1'), { ok: true });
  assert.deepEqual(validateFen('4k3/4r3/8/8/8/8/8/4K3 b - - 0 1'), { ok: false, reason: 'White is in check but it is not their turn.' });
});

test('validateFen passes on parse errors', () => {
  const result = validateFen('nonsense');
  assert.equal(result.ok, false);
});
