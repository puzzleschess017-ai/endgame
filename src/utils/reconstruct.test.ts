import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  RECONSTRUCT_ROUND,
  RECONSTRUCT_SETTINGS_STORAGE_KEY,
  comparePlacement,
  loadReconstructBest,
  loadReconstructSettings,
  placementMap,
  saveReconstructBest,
  saveReconstructSettings,
  shortNames,
} from './reconstruct.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => store.clear());

const REAL = '6k1/5ppp/8/8/8/8/5PPP/3RR1K1';

test('placementMap reads a FEN (with or without the other fields) and rejects broken ones', () => {
  const map = placementMap(`${REAL} w - - 0 1`)!;
  assert.equal(map.size, 10);
  assert.equal(map.get('g8'), 'k');
  assert.equal(map.get('d1'), 'R');
  assert.equal(map.get('g1'), 'K');
  assert.equal(placementMap(REAL)!.size, 10);
  assert.equal(placementMap('8/8/8/8/8/8/8')?.size, undefined);
  assert.equal(placementMap('9/8/8/8/8/8/8/8'), null);
  assert.equal(placementMap('7/8/8/8/8/8/8/8'), null);
  assert.equal(placementMap('x7/8/8/8/8/8/8/8'), null);
  assert.equal(placementMap('8/8/8/8/8/8/8/8')!.size, 0);
});

test('an exact rebuild is perfect, whatever the other FEN fields say', () => {
  const c = comparePlacement(`${REAL} b - - 3 20`, `${REAL} w - - 0 1`);
  assert.deepEqual(c, { correct: 10, total: 10, missed: [], extra: [], perfect: true });
});

test('a missing piece, a piece on the wrong square and an extra piece are told apart', () => {
  // The rooks on d1 and e1 are not there; one stands on e2 instead; and a black pawn was put on a5.
  const c = comparePlacement(REAL, '6k1/5ppp/8/p7/8/8/4RPPP/6K1');
  assert.equal(c.total, 10);
  assert.equal(c.correct, 8);
  assert.equal(c.perfect, false);
  assert.deepEqual([...c.missed].sort(), ['white rook on d1', 'white rook on e1']);
  assert.deepEqual([...c.extra].sort(), ['black pawn on a5', 'white rook on e2']);
});

test('the colour matters: a black rook where a white one stood is wrong', () => {
  const c = comparePlacement('4k3/8/8/8/8/8/8/R3K3', '4k3/8/8/8/8/8/8/r3K3');
  assert.equal(c.correct, 2);
  assert.deepEqual(c.missed, ['white rook on a1']);
  assert.deepEqual(c.extra, ['black rook on a1']);
});

test('an empty board gets nothing right', () => {
  const c = comparePlacement(REAL, '8/8/8/8/8/8/8/8');
  assert.deepEqual([c.correct, c.total, c.extra.length, c.missed.length, c.perfect], [0, 10, 0, 10, false]);
});

test('shortNames writes pieces the short way, black ones with dots in front', () => {
  assert.equal(shortNames(['white rook on d1', 'black pawn on a5', 'white knight on f3', 'black queen on d8']), 'Rd1, …a5, Nf3, …Qd8');
  assert.equal(shortNames([]), '');
});

test('settings: defaults, saving, junk in storage', () => {
  assert.deepEqual(loadReconstructSettings(), { level: 6, seconds: 20 });
  saveReconstructSettings({ level: 10, seconds: 30 });
  assert.deepEqual(loadReconstructSettings(), { level: 10, seconds: 30 });
  store.set(RECONSTRUCT_SETTINGS_STORAGE_KEY, JSON.stringify({ level: 9, seconds: 5 }));
  assert.deepEqual(loadReconstructSettings(), { level: 6, seconds: 20 });
  store.set(RECONSTRUCT_SETTINGS_STORAGE_KEY, 'not json');
  assert.deepEqual(loadReconstructSettings(), { level: 6, seconds: 20 });
});

test('best score is kept per level, only improves, and shares the drills map', () => {
  store.set('ctg_drills_best_v1', JSON.stringify({ color: 20 }));
  assert.equal(loadReconstructBest(6), 0);
  assert.deepEqual(saveReconstructBest(6, 0), { best: 0, isNewBest: false });
  assert.deepEqual(saveReconstructBest(6, 3), { best: 3, isNewBest: true });
  assert.deepEqual(saveReconstructBest(6, 2), { best: 3, isNewBest: false });
  assert.deepEqual(saveReconstructBest(8, 1), { best: 1, isNewBest: true });
  assert.equal(loadReconstructBest(6), 3);
  assert.deepEqual(JSON.parse(store.get('ctg_drills_best_v1')!), { color: 20, 'reconstruct:6': 3, 'reconstruct:8': 1 });
  assert.equal(RECONSTRUCT_ROUND, 5);
});
