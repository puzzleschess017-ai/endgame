import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  BLINDFOLD_BEST_STORAGE_KEY,
  BLINDFOLD_SETTINGS_STORAGE_KEY,
  checkAnswer,
  fetchBlindfoldRound,
  levelDescription,
  levelLabel,
  loadBlindfoldBest,
  loadBlindfoldSettings,
  preparePosition,
  saveBlindfoldBest,
  saveBlindfoldSettings,
  solutionLine,
  stepView,
  checkStep,
} from './blindfold.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => store.clear());

// White to move, back-rank mate: Re8 (or Rd8) is mate, Kh1 and Rd7 are not.
const MATE_FEN = '6k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1';

test('checkAnswer accepts the mate with or without + / # / !', () => {
  for (const text of ['Re8', 'Re8#', 'Re8+', 'Re8!', ' Re8 ', 'R e8', 'e1e8', 'Re1e8', 'R1e8']) {
    const r = checkAnswer(MATE_FEN, text);
    assert.equal(r.kind, 'correct', text);
    assert.equal((r as { san: string }).san, 'Re8#');
  }
});

test('checkAnswer is forgiving about capital letters', () => {
  assert.equal(checkAnswer(MATE_FEN, 're8').kind, 'correct');
  assert.equal(checkAnswer(MATE_FEN, 'RE8').kind, 'illegal');
});

test('checkAnswer: a legal move that is not mate is wrong, an unreadable one is illegal', () => {
  assert.deepEqual(checkAnswer(MATE_FEN, 'Kh1'), { kind: 'wrong', san: 'Kh1' });
  assert.deepEqual(checkAnswer(MATE_FEN, 'Rd7'), { kind: 'wrong', san: 'Rd7' });
  assert.equal(checkAnswer(MATE_FEN, 'Qe8').kind, 'illegal');
  assert.equal(checkAnswer(MATE_FEN, 'hello').kind, 'illegal');
  assert.equal(checkAnswer(MATE_FEN, 'Rxe8').kind, 'illegal');
  assert.equal(checkAnswer(MATE_FEN, '').kind, 'empty');
  assert.equal(checkAnswer(MATE_FEN, '   ').kind, 'empty');
});

test('checkAnswer: promotion mates and captures', () => {
  // a8=Q is mate: the white king on g6 covers g7 and h7, the queen covers rank 8
  const fen = '7k/P7/6K1/8/8/8/8/8 w - - 0 1';
  for (const text of ['a8=Q#', 'a8Q', 'a8=q', 'a8q', 'a7a8q', 'a8=Q+']) {
    assert.equal(checkAnswer(fen, text).kind, 'correct', text);
  }
  // a pawn capture written with a small b must stay a pawn capture
  const capture = '7k/8/8/8/2p5/1P6/8/K7 w - - 0 1';
  assert.deepEqual(checkAnswer(capture, 'bxc4'), { kind: 'wrong', san: 'bxc4' });
});

test('checkAnswer: any mating move counts when there are two', () => {
  // Back-rank mate with either rook
  const fen = '6k1/5ppp/8/8/8/8/5PPP/R3R1K1 w - - 0 1';
  assert.equal(checkAnswer(fen, 'Re8').kind, 'correct');
  assert.equal(checkAnswer(fen, 'Ra8').kind, 'correct');
});

test('preparePosition plays the opponent move and finds the mate', () => {
  // Black plays a quiet king move, then White mates on the back rank.
  const puzzle = {
    fen: '6k1/5ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 1',
    moves: ['g8h8', 'e1e8'],
  };
  const pos = preparePosition(puzzle);
  assert.ok(pos);
  assert.equal(pos.playerColor, 'white');
  assert.deepEqual(pos.lastMove, ['g8', 'h8']);
  assert.equal(pos.mateSan, 'Re8#');
  assert.equal(pos.mateUci, 'e1e8');
  assert.equal(pos.pieceCount, 10);
  assert.equal(preparePosition({ fen: puzzle.fen, moves: ['g8h8', 'e1e8', 'h8g8', 'e8e7'] }), null);
  assert.equal(preparePosition({ fen: puzzle.fen, moves: ['g8h8', 'e1e2'] }), null);
  assert.equal(preparePosition({ fen: 'nonsense', moves: ['a', 'b'] }), null);
});

test('settings: defaults, saving, junk in storage', () => {
  assert.deepEqual(loadBlindfoldSettings(), { level: 8, memorize: 10, mateIn: 1 });
  saveBlindfoldSettings({ level: 6, memorize: 20, mateIn: 3 });
  assert.deepEqual(loadBlindfoldSettings(), { level: 6, memorize: 20, mateIn: 3 });
  store.set(BLINDFOLD_SETTINGS_STORAGE_KEY, JSON.stringify({ level: 9, memorize: 3, mateIn: 4 }));
  assert.deepEqual(loadBlindfoldSettings(), { level: 8, memorize: 10, mateIn: 1 });
  // saved before mate in 2 and 3 existed
  store.set(BLINDFOLD_SETTINGS_STORAGE_KEY, JSON.stringify({ level: 7, memorize: 5 }));
  assert.deepEqual(loadBlindfoldSettings(), { level: 7, memorize: 5, mateIn: 1 });
  store.set(BLINDFOLD_SETTINGS_STORAGE_KEY, 'not json');
  assert.deepEqual(loadBlindfoldSettings(), { level: 8, memorize: 10, mateIn: 1 });
});

test('best score is kept per level and only improves', () => {
  assert.equal(loadBlindfoldBest(8), 0);
  assert.deepEqual(saveBlindfoldBest(8, 0), { best: 0, isNewBest: false });
  assert.deepEqual(saveBlindfoldBest(8, 4), { best: 4, isNewBest: true });
  assert.deepEqual(saveBlindfoldBest(8, 3), { best: 4, isNewBest: false });
  assert.deepEqual(saveBlindfoldBest(8, 4), { best: 4, isNewBest: false });
  assert.deepEqual(saveBlindfoldBest(6, 2), { best: 2, isNewBest: true });
  assert.equal(loadBlindfoldBest(8), 4);
  assert.equal(store.get(BLINDFOLD_BEST_STORAGE_KEY), '{"6":2,"8":4}');
});

test('best scores of mate in 2 and 3 are kept apart from mate in 1 (which keeps its old keys)', () => {
  assert.deepEqual(saveBlindfoldBest(8, 5), { best: 5, isNewBest: true });
  assert.deepEqual(saveBlindfoldBest(8, 2, 2), { best: 2, isNewBest: true });
  assert.deepEqual(saveBlindfoldBest(8, 1, 3), { best: 1, isNewBest: true });
  assert.deepEqual(saveBlindfoldBest(8, 2, 2), { best: 2, isNewBest: false });
  assert.equal(loadBlindfoldBest(8), 5);
  assert.equal(loadBlindfoldBest(8, 2), 2);
  assert.equal(loadBlindfoldBest(8, 3), 1);
  assert.equal(loadBlindfoldBest(6, 2), 0);
  assert.deepEqual(JSON.parse(store.get(BLINDFOLD_BEST_STORAGE_KEY)!), { '8': 5, '2:8': 2, '3:8': 1 });
});

// A real mate in 2 (Lichess puzzle ITJ7Z): White's king steps to b8, then Black plays Rg8+ Rf8 Rxf8#.
const MATE2 = { fen: 'K7/P4R2/2k5/8/8/6r1/8/8 w - - 0 49', moves: ['a8b8', 'g3g8', 'f7f8', 'g8f8'] };

test('preparePosition understands mate in 2: the whole line, who plays what, where it ends', () => {
  const pos = preparePosition(MATE2);
  assert.ok(pos, 'a legal line that ends in mate');
  assert.equal(pos.mateIn, 2);
  assert.equal(pos.playerColor, 'black');
  assert.deepEqual(pos.lastMove, ['a8', 'b8']);
  assert.deepEqual(pos.solution.map((p) => p.byPlayer), [true, false, true]);
  assert.deepEqual(pos.solution.map((p) => p.san), ['Rg8+', 'Rf8', 'Rxf8#']);
  assert.equal(pos.mateSan, 'Rxf8#');
  assert.equal(pos.mateUci, 'g8f8');
  assert.equal(solutionLine(pos), 'Rg8+ Rf8 Rxf8#');
  assert.equal(pos.solution[0].fenBefore, pos.fen);
});

test('preparePosition rejects lines that are not legal, do not end in mate, or have a strange length', () => {
  const { fen } = MATE2;
  assert.equal(preparePosition({ fen, moves: ['a8b8', 'g3g8', 'f7f8', 'g8g1'] }), null); // ends without mate
  assert.equal(preparePosition({ fen, moves: ['a8b8', 'g3g8', 'f7f8', 'a1a2'] }), null); // illegal move
  assert.equal(preparePosition({ fen, moves: ['a8b8', 'g3g8', 'f7f8'] }), null); // three plies
  assert.equal(preparePosition({ fen, moves: [] }), null);
});

test('stepView: the position, the last move and the wanted move at each step', () => {
  const pos = preparePosition(MATE2)!;
  const first = stepView(pos, 0);
  assert.equal(first.fen, pos.fen);
  assert.deepEqual(first.lastMove, ['a8', 'b8']);
  assert.equal(first.expectedUci, 'g3g8');
  assert.equal(first.isLast, false);
  const second = stepView(pos, 1);
  assert.deepEqual(second.lastMove, ['f7', 'f8']);
  assert.equal(second.expectedUci, 'g8f8');
  assert.equal(second.isLast, true);
  // after Kb8 Rg8+ Rf8: the white rook is on f8, the black rook on g8
  assert.ok(second.fen.split(' ')[0].startsWith('1K3Rr1/'), second.fen);
});

test('checkStep: the puzzle move goes on, any mate solves, other moves are wrong, junk is illegal', () => {
  const pos = preparePosition(MATE2)!;
  const first = stepView(pos, 0);
  assert.deepEqual(checkStep(first.fen, 'Rg8+', first.expectedUci), { kind: 'continue', san: 'Rg8+' });
  assert.deepEqual(checkStep(first.fen, 'rg8', first.expectedUci), { kind: 'continue', san: 'Rg8+' });
  assert.equal(checkStep(first.fen, 'Rg7', first.expectedUci).kind, 'wrong');
  assert.equal(checkStep(first.fen, 'Qa9', first.expectedUci).kind, 'illegal');
  assert.equal(checkStep(first.fen, '  ', first.expectedUci).kind, 'empty');
  const second = stepView(pos, 1);
  assert.deepEqual(checkStep(second.fen, 'Rxf8#', second.expectedUci), { kind: 'mate', san: 'Rxf8#' });
  assert.equal(checkStep(second.fen, 'Rg7', second.expectedUci).kind, 'wrong');
  // mate in 1 position through checkStep too: the mating move solves it even when it is not "the" move
  const rooks = checkStep('6k1/5ppp/8/8/8/8/5PPP/R3R1K1 w - - 0 1', 'Ra8', 'e1e8');
  assert.deepEqual(rooks, { kind: 'mate', san: 'Ra8#' });
});

test('fetchBlindfoldRound asks for mate in 2 and 3 and keeps only puzzles of that length', async () => {
  const urls: string[] = [];
  const mate2 = { ...GOOD_PUZZLE, puzzleId: 'm2', ...MATE2, themes: ['mateIn2'] };
  const spy = (async (u: string) => {
    urls.push(u);
    return { ok: true, status: 200, json: async () => ({ puzzles: [mate2, GOOD_PUZZLE] }) };
  }) as unknown as typeof fetch;
  const items = await fetchBlindfoldRound(8, 10, spy, {}, 2);
  assert.equal(urls[0], '/api/puzzles/blindfold?maxPieces=8&count=10&mateIn=2');
  assert.deepEqual(items.map((i) => i.puzzle.puzzleId), ['m2']);
  await assert.rejects(fetchBlindfoldRound(8, 10, spy, {}, 3), /No usable puzzles/);
});

test('level labels', () => {
  assert.equal(levelLabel(6), '6');
  assert.equal(levelLabel(32), 'Any');
  assert.equal(levelDescription(10), 'up to 10 pieces');
  assert.equal(levelDescription(32), 'any number of pieces');
});

const GOOD_PUZZLE = {
  puzzleId: 'p1',
  fen: '6k1/5ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 1',
  moves: ['g8h8', 'e1e8'],
  rating: 900,
  ratingDeviation: 80,
  popularity: 90,
  themes: ['mateIn1'],
  numMoves: 1,
};

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
}

test('fetchBlindfoldRound prepares positions and drops unusable puzzles', async () => {
  const bad = { ...GOOD_PUZZLE, puzzleId: 'p2', moves: ['g8h8', 'e1e2'] };
  const items = await fetchBlindfoldRound(8, 10, fakeFetch(200, { puzzles: [GOOD_PUZZLE, bad] }));
  assert.equal(items.length, 1);
  assert.equal(items[0].puzzle.puzzleId, 'p1');
  assert.equal(items[0].position.mateSan, 'Re8#');
});

test('fetchBlindfoldRound asks for the right level and reports errors', async () => {
  let url = '';
  const spy = (async (u: string) => {
    url = u;
    return { ok: true, status: 200, json: async () => ({ puzzles: [GOOD_PUZZLE] }) };
  }) as unknown as typeof fetch;
  await fetchBlindfoldRound(6, 3, spy);
  assert.equal(url, '/api/puzzles/blindfold?maxPieces=6&count=3');
  await assert.rejects(fetchBlindfoldRound(8, 10, fakeFetch(500, { error: 'No puzzles available for this level.' })), /No puzzles available/);
  await assert.rejects(fetchBlindfoldRound(8, 10, fakeFetch(200, { puzzles: [] })), /No usable puzzles/);
});
