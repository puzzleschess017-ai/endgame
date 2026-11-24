// Run with: npx tsx --test src/utils/coordinates.test.ts
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// Minimal localStorage stand-in for Node.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const c = await import('./coordinates.ts');

beforeEach(() => store.clear());

test('a1 and h8 are dark, a8 and h1 are light', () => {
  assert.equal(c.isDarkSquare('a1'), true);
  assert.equal(c.isDarkSquare('h8'), true);
  assert.equal(c.isDarkSquare('a8'), false);
  assert.equal(c.isDarkSquare('h1'), false);
  assert.equal(c.isDarkSquare('e4'), false);
  assert.equal(c.isDarkSquare('d4'), true);
});

test('randomSquare always returns a valid square and never repeats the previous one', () => {
  let previous: string | null = null;
  for (let i = 0; i < 2000; i++) {
    const sq: string = c.randomSquare(previous);
    assert.ok(c.isSquare(sq), sq);
    assert.notEqual(sq, previous);
    previous = sq;
  }
});

test('randomSquare covers all 64 squares', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 5000; i++) seen.add(c.randomSquare());
  assert.equal(seen.size, 64);
});

test('accuracyPercent', () => {
  assert.equal(c.accuracyPercent(0, 0), 0);
  assert.equal(c.accuracyPercent(3, 1), 75);
  assert.equal(c.accuracyPercent(10, 0), 100);
});

test('settings fall back to defaults for missing or corrupt data', () => {
  assert.deepEqual(c.loadCoordinateSettings(), c.DEFAULT_COORDINATE_SETTINGS);
  store.set(c.SETTINGS_STORAGE_KEY, '{not json');
  assert.deepEqual(c.loadCoordinateSettings(), c.DEFAULT_COORDINATE_SETTINGS);
  store.set(c.SETTINGS_STORAGE_KEY, JSON.stringify({ mode: 'bogus', duration: 45, orientation: 'x', showLabels: 'yes' }));
  assert.deepEqual(c.loadCoordinateSettings(), c.DEFAULT_COORDINATE_SETTINGS);
});

test('settings round-trip', () => {
  const s = { mode: 'name', duration: 60, orientation: 'random', showLabels: true } as const;
  c.saveCoordinateSettings(s);
  assert.deepEqual(c.loadCoordinateSettings(), s);
});

test('best score is kept per mode and duration and only improves', () => {
  assert.equal(c.loadBestScore('find', 30), 0);
  assert.deepEqual(c.saveBestScore('find', 30, 0), { best: 0, isNewBest: false });
  assert.deepEqual(c.saveBestScore('find', 30, 12), { best: 12, isNewBest: true });
  assert.deepEqual(c.saveBestScore('find', 30, 12), { best: 12, isNewBest: false });
  assert.deepEqual(c.saveBestScore('find', 30, 9), { best: 12, isNewBest: false });
  assert.deepEqual(c.saveBestScore('find', 30, 15), { best: 15, isNewBest: true });
  assert.equal(c.loadBestScore('find', 60), 0);
  assert.equal(c.loadBestScore('name', 30), 0);
  assert.deepEqual(c.saveBestScore('name', 60, 7), { best: 7, isNewBest: true });
  assert.equal(c.loadBestScore('find', 30), 15);
});

test('corrupt best-score storage does not throw', () => {
  store.set(c.BEST_STORAGE_KEY, 'garbage');
  assert.equal(c.loadBestScore('find', 30), 0);
  assert.deepEqual(c.saveBestScore('find', 30, 5), { best: 5, isNewBest: true });
  assert.equal(c.loadBestScore('find', 30), 5);
});
