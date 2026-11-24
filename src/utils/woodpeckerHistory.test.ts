import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { loadActivity } from './activity.ts';
import {
  WOODPECKER_HISTORY_LIMIT,
  WOODPECKER_HISTORY_STORAGE_KEY,
  loadWoodpeckerHistory,
  recordFinishedCycles,
  summarizeWoodpecker,
} from './woodpeckerHistory.ts';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};
beforeEach(() => store.clear());

const config = { puzzleCount: 50, totalCycles: 4, difficulty: 'medium' } as const;
const cycle = (n: number, correct: number, incorrect: number, ms: number) => ({
  cycleNumber: n,
  correct,
  incorrect,
  totalTimeMs: ms,
  accuracy: (correct / (correct + incorrect)) * 100,
  completedAt: 1000 + n,
});

test('records finished cycles once, even when asked again', () => {
  const session = { id: 's1', config, cycleResults: [cycle(1, 45, 5, 600_000)] };
  assert.equal(recordFinishedCycles(session), 1);
  assert.equal(recordFinishedCycles(session), 0);
  const withSecond = { ...session, cycleResults: [...session.cycleResults, cycle(2, 50, 0, 500_000)] };
  assert.equal(recordFinishedCycles(withSecond), 1);
  const history = loadWoodpeckerHistory();
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((r) => r.key), ['s1:1', 's1:2']);
  assert.equal(history[0].puzzleCount, 50);
  assert.equal(history[0].difficulty, 'medium');
});

test('nothing to record for no session or no finished cycle', () => {
  assert.equal(recordFinishedCycles(null), 0);
  assert.equal(recordFinishedCycles({ id: 'x', config, cycleResults: [] }), 0);
  assert.equal(store.has(WOODPECKER_HISTORY_STORAGE_KEY), false);
});

test('two sessions with the same cycle number are both kept', () => {
  recordFinishedCycles({ id: 'a', config, cycleResults: [cycle(1, 40, 10, 700_000)] });
  recordFinishedCycles({ id: 'b', config, cycleResults: [cycle(1, 41, 9, 650_000)] });
  assert.equal(loadWoodpeckerHistory().length, 2);
});

test('history is capped, newest kept', () => {
  const many = Array.from({ length: WOODPECKER_HISTORY_LIMIT + 20 }, (_, i) => cycle(i + 1, 10, 0, 1000));
  recordFinishedCycles({ id: 'big', config, cycleResults: many });
  const history = loadWoodpeckerHistory();
  assert.equal(history.length, WOODPECKER_HISTORY_LIMIT);
  assert.equal(history[history.length - 1].key, `big:${WOODPECKER_HISTORY_LIMIT + 20}`);
});

test('junk in storage is ignored', () => {
  store.set(WOODPECKER_HISTORY_STORAGE_KEY, 'not json');
  assert.deepEqual(loadWoodpeckerHistory(), []);
  store.set(WOODPECKER_HISTORY_STORAGE_KEY, '{"a":1}');
  assert.deepEqual(loadWoodpeckerHistory(), []);
  store.set(WOODPECKER_HISTORY_STORAGE_KEY, '[1,null,{"key":"k","accuracy":90,"timeMs":5,"correct":3,"incorrect":0}]');
  assert.equal(loadWoodpeckerHistory().length, 1);
});

test('summary: cycles, puzzles, best accuracy, fastest perfect cycle', () => {
  assert.deepEqual(summarizeWoodpecker([]), { cycles: 0, puzzlesSolved: 0, bestAccuracy: 0, fastestPerfectMs: null });
  recordFinishedCycles({
    id: 's',
    config,
    cycleResults: [cycle(1, 45, 5, 600_000), cycle(2, 50, 0, 520_000), cycle(3, 50, 0, 480_000), cycle(4, 48, 2, 400_000)],
  });
  assert.deepEqual(summarizeWoodpecker(loadWoodpeckerHistory()), {
    cycles: 4,
    puzzlesSolved: 193,
    bestAccuracy: 100,
    fastestPerfectMs: 480_000,
  });
});

test('finished cycles also count as training activity, once', () => {
  const session = { id: 'act', config, cycleResults: [cycle(1, 45, 5, 600_000)] };
  recordFinishedCycles(session);
  recordFinishedCycles(session);
  const days = Object.values(loadActivity());
  assert.equal(days.length, 1);
  assert.deepEqual(days[0], { sessions: 1, ms: 600_000, puzzles: 45, correct: 45, wrong: 5 });
});

test('a cycle is not counted again after the history was removed (signing out) while its session stayed', () => {
  const session = { id: 's9', config, cycleResults: [cycle(1, 37, 3, 600_000), cycle(2, 40, 0, 500_000)] };
  assert.equal(recordFinishedCycles(session), 2);
  assert.equal(loadActivity()[Object.keys(loadActivity())[0]].puzzles, 77);
  // what signing out does to the browser: the account's history and activity are removed
  store.delete(WOODPECKER_HISTORY_STORAGE_KEY);
  store.delete('ctg_activity_v1');
  assert.equal(recordFinishedCycles(session), 0);
  assert.deepEqual(loadActivity(), {});
  assert.deepEqual(loadWoodpeckerHistory(), []);
  // a new cycle of the same session is still counted
  const more = { ...session, cycleResults: [...session.cycleResults, cycle(3, 30, 0, 400_000)] };
  assert.equal(recordFinishedCycles(more), 1);
});
