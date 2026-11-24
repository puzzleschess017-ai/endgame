import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  back,
  createAnalysis,
  currentFen,
  exportPgn,
  forward,
  goTo,
  lastMoveAt,
  moveRows,
  parsePgn,
  playMove,
  positionAt,
  statusAt,
  toEnd,
  toStart,
} from './analysis.ts';
import type { Analysis } from './analysis.ts';
import { START_FEN } from './editor.ts';

function play(analysis: Analysis, ...moves: string[]): Analysis {
  let a = analysis;
  for (const m of moves) {
    const result = playMove(a, m.slice(0, 2), m.slice(2, 4), m.length > 4 ? (m[4] as 'q') : undefined);
    assert.ok(result, `${m} should be legal`);
    a = result.analysis;
  }
  return a;
}

test('a new analysis starts at the start position with no moves', () => {
  const a = createAnalysis();
  assert.equal(currentFen(a), START_FEN);
  assert.equal(a.moves.length, 0);
  assert.equal(a.index, 0);
});

test('playing moves adds them and moves to the end', () => {
  const a = play(createAnalysis(), 'e2e4', 'e7e5', 'g1f3');
  assert.deepEqual(a.moves.map((m) => m.san), ['e4', 'e5', 'Nf3']);
  assert.equal(a.index, 3);
  assert.equal(currentFen(a), 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
});

test('an illegal move is refused and changes nothing', () => {
  assert.equal(playMove(createAnalysis(), 'e2', 'e5'), null);
  assert.equal(playMove(createAnalysis(), 'e7', 'e5'), null);
});

test('moves record captures and checks', () => {
  const a = play(createAnalysis(), 'e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5e5');
  assert.equal(a.moves[2].capture, true);
  assert.equal(a.moves[3].capture, true);
  assert.equal(a.moves[1].capture, false);
  const mate = play(createAnalysis(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  assert.equal(mate.moves[3].check, true);
  assert.equal(mate.moves[3].san, 'Qh4#');
});

test('stepping back, forward, to the start and to the end', () => {
  let a = play(createAnalysis(), 'e2e4', 'e7e5', 'g1f3');
  a = back(a);
  assert.equal(a.index, 2);
  assert.equal(currentFen(a), positionAt(a, 2));
  a = toStart(a);
  assert.equal(a.index, 0);
  assert.equal(currentFen(a), START_FEN);
  assert.equal(back(a), a);
  a = forward(a);
  assert.equal(a.index, 1);
  a = toEnd(a);
  assert.equal(a.index, 3);
  assert.equal(forward(a), a);
  assert.equal(goTo(a, 99).index, 3);
  assert.equal(goTo(a, -4).index, 0);
});

test('lastMoveAt gives the move that led to the shown position', () => {
  const a = play(createAnalysis(), 'e2e4', 'e7e5');
  assert.equal(lastMoveAt(a)?.san, 'e5');
  assert.equal(lastMoveAt(back(a))?.san, 'e4');
  assert.equal(lastMoveAt(toStart(a)), undefined);
});

test('playing the next move of the game only steps forward', () => {
  let a = play(createAnalysis(), 'e2e4', 'e7e5', 'g1f3');
  a = toStart(a);
  const result = playMove(a, 'e2', 'e4');
  assert.ok(result);
  assert.equal(result.analysis.moves.length, 3);
  assert.equal(result.analysis.index, 1);
});

test('playing a different move replaces the rest of the game', () => {
  let a = play(createAnalysis(), 'e2e4', 'e7e5', 'g1f3');
  a = goTo(a, 1);
  const result = playMove(a, 'c7', 'c5');
  assert.ok(result);
  assert.deepEqual(result.analysis.moves.map((m) => m.san), ['e4', 'c5']);
  assert.equal(result.analysis.index, 2);
});

test('promotion needs a piece and becomes part of the move', () => {
  const start = createAnalysis('6k1/P7/8/8/8/8/8/6K1 w - - 0 1');
  const result = playMove(start, 'a7', 'a8', 'q');
  assert.ok(result);
  assert.equal(result.move.san, 'a8=Q+');
  assert.equal(result.move.uci, 'a7a8q');
  const knight = playMove(start, 'a7', 'a8', 'n');
  assert.equal(knight?.move.san, 'a8=N');
});

test('moveRows pairs moves into numbered rows', () => {
  const a = play(createAnalysis(), 'e2e4', 'e7e5', 'g1f3');
  assert.deepEqual(moveRows(a), [
    { number: 1, white: { san: 'e4', index: 1 }, black: { san: 'e5', index: 2 } },
    { number: 2, white: { san: 'Nf3', index: 3 } },
  ]);
});

test('moveRows starts with Black when the position has Black to move', () => {
  const a = play(createAnalysis('4k3/8/8/8/8/8/4P3/4K3 b - - 0 12'), 'e8d7', 'e2e4');
  assert.deepEqual(moveRows(a), [
    { number: 12, black: { san: 'Kd7', index: 1 } },
    { number: 13, white: { san: 'e4', index: 2 } },
  ]);
});

test('statusAt: turn, check, mate, stalemate and draws', () => {
  assert.deepEqual(statusAt(createAnalysis()), { text: 'White to move', over: false });
  const check = play(createAnalysis(), 'e2e4', 'f7f5', 'd1h5');
  assert.deepEqual(statusAt(check), { text: 'Black to move, in check', over: false });
  const mate = play(createAnalysis(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  assert.deepEqual(statusAt(mate), { text: 'Checkmate, Black wins', over: true });
  assert.deepEqual(statusAt(goTo(mate, 3)), { text: 'Black to move', over: false });
  assert.deepEqual(statusAt(createAnalysis('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), { text: 'Stalemate, a draw', over: true });
  assert.deepEqual(statusAt(createAnalysis('8/8/8/4k3/8/8/8/4K3 w - - 0 1')), { text: 'Draw: not enough material', over: true });
});

test('statusAt sees threefold repetition', () => {
  const a = play(createAnalysis(), 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
  assert.deepEqual(statusAt(a), { text: 'Draw by threefold repetition', over: true });
});

test('parsePgn reads the main line and ignores comments and variations', () => {
  const result = parsePgn('[Event "x"]\n\n1. e4 {best by test} e5 (1... c5 2. Nf3) 2. Nf3 $1 Nc6 3. Bb5 a6 *');
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.moves.map((m) => m.san), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    assert.equal(result.startFen, START_FEN);
    assert.equal(result.moves[5].fen, 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4');
  }
});

test('parsePgn uses the FEN header as the start position', () => {
  const result = parsePgn('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 1"]\n\n1... Kd7 2. e4 *');
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.startFen, '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1');
    assert.deepEqual(result.moves.map((m) => m.san), ['Kd7', 'e4']);
  }
});

test('parsePgn reports problems', () => {
  for (const bad of ['', '   ', 'hello world', '1. e4 e5 2. Ke4 *', '[Event "x"]\n\n*']) {
    const result = parsePgn(bad);
    assert.equal(result.ok, false, JSON.stringify(bad));
    if (!result.ok) assert.ok(result.error.length > 5);
  }
});

test('exportPgn then parsePgn gives the same game back', () => {
  const a = play(createAnalysis(), 'e2e4', 'e7e5', 'g1f3', 'b8c6');
  const pgn = exportPgn(a);
  assert.match(pgn, /1\. e4 e5 2\. Nf3 Nc6/);
  assert.match(pgn, /\[Event "Analysis"\]/);
  const back = parsePgn(pgn);
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(back.moves.map((m) => m.san), a.moves.map((m) => m.san));
});

test('exportPgn keeps a custom starting position in the headers', () => {
  const a = play(createAnalysis('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1'), 'e8d7', 'e2e4');
  const pgn = exportPgn(a);
  assert.match(pgn, /\[SetUp "1"\]/);
  assert.match(pgn, /\[FEN "4k3\/8\/8\/8\/8\/8\/4P3\/4K3 b - - 0 1"\]/);
  const again = parsePgn(pgn);
  assert.ok(again.ok);
  if (again.ok) {
    assert.equal(again.startFen, '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1');
    assert.equal(again.moves.length, 2);
  }
});
