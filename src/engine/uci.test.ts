import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forWhite, formatScore, numberMoves, parseBestMove, parseInfo, pvToSan, whiteShare } from './uci.ts';

const INFO = 'info depth 14 seldepth 18 multipv 2 score cp 35 nodes 12345 nps 90000 time 120 pv e2e4 e7e5 g1f3';

test('reads depth, line number, score and moves of an info line', () => {
  assert.deepEqual(parseInfo(INFO), { multipv: 2, depth: 14, cp: 35, mate: null, pv: ['e2e4', 'e7e5', 'g1f3'] });
});

test('a line without multipv is line 1, and a mate score is kept as a mate', () => {
  assert.deepEqual(parseInfo('info depth 9 score mate -3 pv a1a8'), { multipv: 1, depth: 9, cp: null, mate: -3, pv: ['a1a8'] });
});

test('lines that are not a result give null', () => {
  assert.equal(parseInfo('info string NNUE evaluation using nn.nnue'), null);
  assert.equal(parseInfo('info depth 5 currmove e2e4 currmovenumber 1'), null);
  assert.equal(parseInfo('info depth 12 score cp 40 lowerbound pv e2e4'), null);
  assert.equal(parseInfo('info depth 12 score cp 40 upperbound pv e2e4'), null);
  assert.equal(parseInfo('readyok'), null);
  assert.equal(parseInfo(''), null);
  assert.equal(parseInfo('info depth 4 score cp x pv e2e4'), null);
});

test('best move', () => {
  assert.equal(parseBestMove('bestmove e2e4 ponder e7e5'), 'e2e4');
  assert.equal(parseBestMove('bestmove e7e8q'), 'e7e8q');
  assert.equal(parseBestMove('bestmove (none)'), null);
  assert.equal(parseBestMove('info depth 1'), null);
});

test('the score is turned to White\'s side when Black is to move', () => {
  const line = parseInfo(INFO)!;
  assert.equal(forWhite(line, 'w').cp, 35);
  assert.equal(forWhite(line, 'b').cp, -35);
  assert.equal(forWhite({ ...line, cp: null, mate: 2 }, 'b').mate, -2);
});

test('scores are written the way people read them', () => {
  assert.equal(formatScore({ cp: 63, mate: null }), '+0.6');
  assert.equal(formatScore({ cp: -130, mate: null }), '-1.3');
  assert.equal(formatScore({ cp: 3, mate: null }), '0.0');
  assert.equal(formatScore({ cp: null, mate: 3 }), 'M3');
  assert.equal(formatScore({ cp: null, mate: -2 }), '-M2');
  assert.equal(formatScore({ cp: null, mate: 0 }), '#');
});

test('the bar: equal is half, a mate fills it, more pawns fill more', () => {
  assert.equal(whiteShare({ cp: 0, mate: null }), 50);
  assert.equal(whiteShare({ cp: null, mate: 4 }), 100);
  assert.equal(whiteShare({ cp: null, mate: -1 }), 0);
  const one = whiteShare({ cp: 100, mate: null });
  const three = whiteShare({ cp: 300, mate: null });
  assert.ok(one > 55 && one < 65, String(one));
  assert.ok(three > one && three < 85);
  assert.equal(whiteShare({ cp: -300, mate: null }), Math.round((100 - three) * 10) / 10);
  assert.ok(whiteShare({ cp: 99999, mate: null }) < 100);
});

test('moves become notation and stop at an illegal move', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  assert.deepEqual(pvToSan(start, ['e2e4', 'e7e5', 'g1f3']), ['e4', 'e5', 'Nf3']);
  assert.deepEqual(pvToSan(start, ['e2e4', 'e2e4', 'g1f3']), ['e4']);
  assert.deepEqual(pvToSan(start, ['e2e4', 'e7e5', 'g1f3'], 2), ['e4', 'e5']);
  assert.deepEqual(pvToSan('not a fen', ['e2e4']), []);
  assert.deepEqual(pvToSan('8/P6k/8/8/8/8/8/K7 w - - 0 1', ['a7a8q']), ['a8=Q']);
});

test('moves are numbered from the position', () => {
  assert.equal(numberMoves('8/8/8/8/8/8/8/K6k w - - 0 1', ['Kb2', 'Kg2', 'Kc3']), '1. Kb2 Kg2 2. Kc3');
  assert.equal(numberMoves('8/8/8/8/8/8/8/K6k b - - 0 7', ['Kg2', 'Kb2', 'Kf2']), '7... Kg2 8. Kb2 Kf2');
});
