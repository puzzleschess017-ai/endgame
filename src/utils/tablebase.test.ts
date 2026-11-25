import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  countPieces,
  fetchTablebase,
  lookupProblem,
  moveLabel,
  verdictText,
  type TablebaseMove,
  type TablebaseResult,
} from './tablebase.ts';

const base: TablebaseResult = {
  fen: 'x',
  outcome: 'win',
  matein: 9,
  checkmate: false,
  stalemate: false,
  insufficientMaterial: false,
  moves: [],
};

test('lookupProblem: piece limit and castling', () => {
  assert.equal(lookupProblem('4k3/6KP/8/8/8/8/7p/8 w - - 0 1'), null);
  assert.equal(lookupProblem('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1')?.includes('32'), true);
  assert.equal(lookupProblem('4k2r/8/8/8/8/8/8/4K3 w k - 0 1')?.includes('castling'), true);
  assert.equal(countPieces('r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4'), 32);
  assert.equal(lookupProblem('3k4/8/8/8/8/8/8/R3K2R w - - 0 1'), null);
});

test('verdictText speaks for the side to move', () => {
  assert.deepEqual(verdictText(base, 'w'), { headline: 'White wins', detail: 'Mate in 9 with best play', tone: 'good' });
  assert.deepEqual(verdictText(base, 'b'), { headline: 'Black wins', detail: 'Mate in 9 with best play', tone: 'good' });
  assert.deepEqual(verdictText({ ...base, outcome: 'loss' }, 'w'), { headline: 'Black wins', detail: 'Mate in 9 with best play', tone: 'bad' });
  assert.equal(verdictText({ ...base, matein: null }, 'w').detail, undefined);
  assert.equal(verdictText({ ...base, outcome: 'draw', matein: null }, 'w').headline, 'Draw');
  assert.equal(verdictText({ ...base, outcome: 'cursed-win' }, 'w').headline, 'Draw by the 50-move rule');
  assert.match(verdictText({ ...base, outcome: 'cursed-win' }, 'w').detail ?? '', /White is winning/);
  assert.match(verdictText({ ...base, outcome: 'blessed-loss' }, 'w').detail ?? '', /Black is winning/);
  assert.equal(verdictText({ ...base, outcome: 'unknown' }, 'w').headline, 'No answer for this position');
  assert.equal(verdictText({ ...base, checkmate: true, outcome: 'loss' }, 'b').headline, 'Checkmate, White wins');
  assert.equal(verdictText({ ...base, stalemate: true, outcome: 'draw' }, 'b').headline, 'Stalemate, a draw');
  assert.equal(verdictText({ ...base, insufficientMaterial: true, outcome: 'draw' }, 'b').headline, 'Draw, not enough material');
});

test('moveLabel', () => {
  const move = (outcome: TablebaseMove['outcome'], checkmate = false): TablebaseMove => ({ uci: 'a1a2', san: 'Ra2', outcome, checkmate, zeroing: false });
  assert.deepEqual(moveLabel(move('win')), { text: 'Wins', tone: 'good' });
  assert.deepEqual(moveLabel(move('draw')), { text: 'Draws', tone: 'neutral' });
  assert.deepEqual(moveLabel(move('loss')), { text: 'Loses', tone: 'bad' });
  assert.equal(moveLabel(move('cursed-win')).text, 'Draws (50-move rule)');
  assert.equal(moveLabel(move('blessed-loss')).text, 'Draws (50-move rule)');
  assert.deepEqual(moveLabel(move('win', true)), { text: 'Checkmate', tone: 'good' });
  assert.equal(moveLabel(move('unknown')).text, '?');
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('fetchTablebase: answers, server errors, bad answers and no connection', async () => {
  let seen = '';
  globalThis.fetch = (async (url: string | URL | Request) => {
    seen = String(url);
    return new Response(JSON.stringify({ ...base, moves: [] }), { status: 200 });
  }) as typeof fetch;
  const ok = await fetchTablebase('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  assert.ok(ok.ok);
  assert.equal(seen, '/api/tablebase?fen=4k3%2F8%2F8%2F8%2F8%2F8%2F8%2F4K3%20w%20-%20-%200%201');

  globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'The tablebase is busy, try again in a minute.' }), { status: 503 })) as typeof fetch;
  assert.deepEqual(await fetchTablebase('x'), { ok: false, error: 'The tablebase is busy, try again in a minute.' });

  globalThis.fetch = (async () => new Response('<html>oops</html>', { status: 502 })) as typeof fetch;
  const html = await fetchTablebase('x');
  assert.ok(!html.ok && /could not be reached/.test(html.error));

  globalThis.fetch = (async () => new Response(JSON.stringify({ hello: 1 }), { status: 200 })) as typeof fetch;
  const odd = await fetchTablebase('x');
  assert.ok(!odd.ok && /could not be read/.test(odd.error));

  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;
  const offline = await fetchTablebase('x');
  assert.ok(!offline.ok && /connection/.test(offline.error));
});
