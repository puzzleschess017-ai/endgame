import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickEngine } from './files.ts';

const f = (path: string, size = 1000) => ({ path, size });

test('picks the light single-thread build', () => {
  const files = [
    f('bin/stockfish-18.js', 90_000_000), f('bin/stockfish-18.wasm', 90_000_000),
    f('bin/stockfish-18-single.js'), f('bin/stockfish-18-single.wasm', 80_000_000),
    f('bin/stockfish-18-lite-single.js'), f('bin/stockfish-18-lite-single.wasm', 7_000_000),
    f('bin/stockfish-18-lite.js'), f('bin/stockfish-18-lite.wasm', 7_100_000),
    f('index.js'), f('scripts/findEngine.js'),
  ];
  assert.deepEqual(pickEngine(files), { js: 'bin/stockfish-18-lite-single.js', wasm: 'bin/stockfish-18-lite-single.wasm' });
});

test('without a light build the single-thread one is used', () => {
  const files = [f('a/engine-single.js'), f('a/engine-single.wasm'), f('a/engine-multi.js'), f('a/engine-multi.wasm')];
  assert.equal(pickEngine(files)?.js, 'a/engine-single.js');
});

test('a build that needs threads is never used', () => {
  assert.equal(pickEngine([f('x/stockfish-multithread.js'), f('x/stockfish-multithread.wasm')]), null);
});

test('a script without a wasm file of the same name is skipped, and no files give null', () => {
  assert.equal(pickEngine([f('index.js'), f('other.wasm')]), null);
  assert.equal(pickEngine([]), null);
});

test('of two equal builds the smaller download wins', () => {
  const files = [f('a-lite-single.js'), f('a-lite-single.wasm', 9000), f('b-lite-single.js'), f('b-lite-single.wasm', 7000)];
  assert.equal(pickEngine(files)?.js, 'b-lite-single.js');
});
