import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkPosition,
  countPieces,
  createTablebase,
  flipOutcome,
  normalizeResponse,
  outcomeOf,
} from './tablebase.ts';

// The example of the Lichess tablebase README: White to move wins with h8=Q.
const FEN = '4k3/6KP/8/8/8/8/7p/8 w - - 0 1';
const ANSWER = {
  checkmate: false,
  stalemate: false,
  insufficient_material: false,
  dtz: 1,
  precise_dtz: 1,
  dtm: 17,
  category: 'win',
  moves: [
    { uci: 'h7h8q', san: 'h8=Q+', zeroing: true, checkmate: false, dtz: -2, dtm: -16, category: 'loss' },
    { uci: 'g7f6', san: 'Kf6', zeroing: false, checkmate: false, dtz: 0, dtm: 0, category: 'draw' },
    { uci: 'g7g6', san: 'Kg6', zeroing: false, checkmate: false, category: 'cursed-win' },
    { uci: 'g7h6', san: 'Kh6', zeroing: false, checkmate: false, category: 'win' },
  ],
};

function fakeFetch(answer: unknown, status = 200) {
  const calls: string[] = [];
  const impl = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

test('countPieces counts only the board', () => {
  assert.equal(countPieces(FEN), 4 + 0 + 0);
  assert.equal(countPieces('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), 32);
});

test('checkPosition cleans good positions and explains bad ones', () => {
  assert.deepEqual(checkPosition(FEN), { ok: true, fen: FEN });
  assert.deepEqual(checkPosition('4k3/6KP/8/8/8/8/7p/8_w_-_-_0_1'), { ok: true, fen: FEN });
  for (const bad of [undefined, null, 42, '', 'x'.repeat(200), 'not a fen', '8/8/8/8/8/8/8/8 w - - 0 1']) {
    const result = checkPosition(bad);
    assert.equal(result.ok, false, String(bad));
  }
  const tooMany = checkPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');
  assert.ok(!tooMany.ok && /7 pieces or fewer/.test(tooMany.error));
  const castling = checkPosition('4k2r/8/8/8/8/8/8/4K3 w k - 0 1');
  assert.ok(!castling.ok && /castling/.test(castling.error));
  assert.equal(checkPosition('4k3/8/8/8/8/8/8/4K2R w K - 0 1').ok, false);
});

test('outcomes: names, aliases and turning around', () => {
  assert.equal(outcomeOf('win'), 'win');
  assert.equal(outcomeOf('syzygy-win'), 'win');
  assert.equal(outcomeOf('maybe-win'), 'win');
  assert.equal(outcomeOf('syzygy-loss'), 'loss');
  assert.equal(outcomeOf('maybe-loss'), 'loss');
  assert.equal(outcomeOf('cursed-win'), 'cursed-win');
  assert.equal(outcomeOf('blessed-loss'), 'blessed-loss');
  assert.equal(outcomeOf('draw'), 'draw');
  assert.equal(outcomeOf('something new'), 'unknown');
  assert.equal(outcomeOf(undefined), 'unknown');
  for (const o of ['win', 'cursed-win', 'draw', 'blessed-loss', 'loss', 'unknown'] as const) {
    assert.equal(flipOutcome(flipOutcome(o)), o);
  }
  assert.equal(flipOutcome('win'), 'loss');
  assert.equal(flipOutcome('cursed-win'), 'blessed-loss');
  assert.equal(flipOutcome('draw'), 'draw');
});

test('normalizeResponse turns move categories around to the mover and counts moves to mate', () => {
  const result = normalizeResponse(FEN, ANSWER);
  assert.ok(result);
  assert.equal(result.outcome, 'win');
  assert.equal(result.matein, 9); // dtm 17 plies
  assert.deepEqual(
    result.moves.map((m) => [m.san, m.outcome]),
    [
      ['h8=Q+', 'win'], // the opponent is lost after it
      ['Kf6', 'draw'],
      ['Kg6', 'blessed-loss'], // the opponent has a "cursed win" after it
      ['Kh6', 'loss'],
    ],
  );
  assert.equal(result.moves[0].zeroing, true);
  assert.equal(result.moves[1].zeroing, false);
});

test('normalizeResponse: no mate distance for draws, for mate itself, or when unknown', () => {
  assert.equal(normalizeResponse(FEN, { ...ANSWER, category: 'draw', dtm: 0 })?.matein, null);
  assert.equal(normalizeResponse(FEN, { ...ANSWER, dtm: null })?.matein, null);
  assert.equal(normalizeResponse(FEN, { ...ANSWER, category: 'cursed-win', dtm: 40 })?.matein, null);
  assert.equal(normalizeResponse(FEN, { ...ANSWER, category: 'loss', dtm: -16 })?.matein, 8);
  const mated = normalizeResponse(FEN, { checkmate: true, category: 'loss', dtm: 0, moves: [] });
  assert.equal(mated?.checkmate, true);
  assert.equal(mated?.matein, null);
});

test('normalizeResponse refuses answers that are not tablebase answers', () => {
  assert.equal(normalizeResponse(FEN, null), null);
  assert.equal(normalizeResponse(FEN, 'hello'), null);
  assert.equal(normalizeResponse(FEN, { category: 'win' }), null);
  assert.equal(normalizeResponse(FEN, { moves: [] }), null);
  assert.equal(normalizeResponse(FEN, { category: 'win', moves: [{ uci: 'e2e4' }] }), null);
});

test('lookup asks Lichess once and then answers from memory', async () => {
  const { impl, calls } = fakeFetch(ANSWER);
  const tablebase = createTablebase({ fetchImpl: impl, baseUrl: 'https://example.test/' });
  const first = await tablebase.lookup(FEN);
  assert.ok(first.ok);
  assert.equal(first.cached, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], `https://example.test/standard?fen=${encodeURIComponent(FEN)}`);
  const second = await tablebase.lookup('4k3/6KP/8/8/8/8/7p/8_w_-_-_0_1');
  assert.ok(second.ok);
  assert.equal(second.cached, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(second.result, first.result);
});

test('lookup: the same position asked at the same time is one request', async () => {
  const { impl, calls } = fakeFetch(ANSWER);
  const tablebase = createTablebase({ fetchImpl: impl });
  const [a, b, c] = await Promise.all([tablebase.lookup(FEN), tablebase.lookup(FEN), tablebase.lookup(FEN)]);
  assert.ok(a.ok && b.ok && c.ok);
  assert.equal(calls.length, 1);
});

test('lookup: answers are forgotten after the time limit and the cache has a size limit', async () => {
  let clock = 1_000;
  const { impl, calls } = fakeFetch(ANSWER);
  const tablebase = createTablebase({ fetchImpl: impl, now: () => clock, ttlMs: 1000, maxEntries: 2 });
  await tablebase.lookup(FEN);
  clock += 500;
  await tablebase.lookup(FEN);
  assert.equal(calls.length, 1);
  clock += 600;
  await tablebase.lookup(FEN);
  assert.equal(calls.length, 2);
  await tablebase.lookup('8/8/8/4k3/8/8/2Q5/4K3 w - - 0 1');
  await tablebase.lookup('8/8/8/4k3/8/8/2R5/4K3 w - - 0 1');
  assert.equal(tablebase.cacheSize(), 2);
});

test('lookup: bad input never reaches Lichess', async () => {
  const { impl, calls } = fakeFetch(ANSWER);
  const tablebase = createTablebase({ fetchImpl: impl });
  for (const bad of [undefined, 'nonsense', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', '4k2r/8/8/8/8/8/8/4K3 w k - 0 1']) {
    const result = await tablebase.lookup(bad);
    assert.ok(!result.ok && result.status === 400);
  }
  assert.equal(calls.length, 0);
});

test('lookup: failures are reported and not remembered', async () => {
  for (const [status, expected] of [[404, 422], [429, 503], [500, 502]] as const) {
    const { impl, calls } = fakeFetch({}, status);
    const tablebase = createTablebase({ fetchImpl: impl });
    const first = await tablebase.lookup(FEN);
    assert.ok(!first.ok && first.status === expected, `HTTP ${status}`);
    await tablebase.lookup(FEN);
    assert.equal(calls.length, 2);
    assert.equal(tablebase.cacheSize(), 0);
  }
  const broken = createTablebase({ fetchImpl: (async () => { throw new Error('offline'); }) as typeof fetch });
  const result = await broken.lookup(FEN);
  assert.ok(!result.ok && result.status === 502);
  const garbage = createTablebase({ fetchImpl: fakeFetch({ hello: 1 }).impl });
  const unreadable = await garbage.lookup(FEN);
  assert.ok(!unreadable.ok && unreadable.status === 502);
});

test('lookup: a slow tablebase is given up on', async () => {
  const slow = (async (_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as typeof fetch;
  const tablebase = createTablebase({ fetchImpl: slow, timeoutMs: 30 });
  const started = Date.now();
  const result = await tablebase.lookup(FEN);
  assert.ok(!result.ok && result.status === 502);
  assert.ok(Date.now() - started < 1000);
});

test('lookup: there is a ceiling on requests sent to Lichess per minute', async () => {
  let clock = 0;
  const { impl, calls } = fakeFetch(ANSWER, 500);
  const tablebase = createTablebase({ fetchImpl: impl, now: () => clock, maxUpstreamPerMinute: 3 });
  for (let i = 0; i < 3; i++) await tablebase.lookup(FEN);
  assert.equal(calls.length, 3);
  const blocked = await tablebase.lookup(FEN);
  assert.ok(!blocked.ok && blocked.status === 503);
  assert.equal(calls.length, 3);
  clock += 61_000;
  await tablebase.lookup(FEN);
  assert.equal(calls.length, 4);
});
