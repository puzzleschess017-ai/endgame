import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STORAGE_KEY } from './chessHelpers.ts';
import { applyRunOwner, IN_PROGRESS_KEYS, RUN_OWNER_KEY } from './runOwner.ts';
import { STREAK_RUN_STORAGE_KEY } from './streak.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}
const running = { endgame_woodpecker_session_v1: 'cycle', ctg_streak_run_v1: 'run' };

describe('unfinished runs belong to the account that started them', () => {
  it('the keys are the ones the pages use', () => {
    assert.deepEqual([...IN_PROGRESS_KEYS].sort(), [STORAGE_KEY, STREAK_RUN_STORAGE_KEY].sort());
  });
  it('another account signing in does not get the runs of the first one', () => {
    const s = memory({ ...running, [RUN_OWNER_KEY]: 'user-a' });
    assert.equal(applyRunOwner(s, 'user-b'), true);
    assert.equal(s.getItem('endgame_woodpecker_session_v1'), null);
    assert.equal(s.getItem('ctg_streak_run_v1'), null);
    assert.equal(s.getItem(RUN_OWNER_KEY), 'user-b');
  });
  it('signing out removes the runs of the account, so the next guest does not get them', () => {
    const s = memory({ ...running, [RUN_OWNER_KEY]: 'user-a' });
    assert.equal(applyRunOwner(s, null), true);
    assert.equal(s.getItem('endgame_woodpecker_session_v1'), null);
    assert.equal(s.getItem(RUN_OWNER_KEY), 'guest');
  });
  it('the same account (a reload, another tab) keeps its runs', () => {
    const s = memory({ ...running, [RUN_OWNER_KEY]: 'user-a' });
    assert.equal(applyRunOwner(s, 'user-a'), false);
    assert.equal(s.getItem('ctg_streak_run_v1'), 'run');
  });
  it('a guest who signs in keeps what they were doing; so does a first visit with unknown owner', () => {
    const guest = memory({ ...running, [RUN_OWNER_KEY]: 'guest' });
    assert.equal(applyRunOwner(guest, 'user-a'), false);
    assert.equal(guest.getItem('endgame_woodpecker_session_v1'), 'cycle');
    assert.equal(guest.getItem(RUN_OWNER_KEY), 'user-a');
    const unknown = memory({ ...running });
    assert.equal(applyRunOwner(unknown, 'user-a'), false);
    assert.equal(unknown.getItem('ctg_streak_run_v1'), 'run');
  });
});
