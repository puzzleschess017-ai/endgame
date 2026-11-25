import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuthSession } from '../auth/client.ts';
import { createSyncClient, type RemoteData, type SyncClient } from './client.ts';
import { SYNCED_KEYS, fingerprint, mergeData, serialize } from './data.ts';
import { createSyncEngine, type StorageLike } from './engine.ts';

const ACTIVITY = 'ctg_activity_v1';
const HISTORY = 'ctg_woodpecker_history_v1';
const STREAK = 'ctg_streak_best_v1';
const RACE = 'ctg_race_best_v1';

const day = (sessions: number, correct = 0) => ({ sessions, ms: sessions * 1000, puzzles: correct, correct, wrong: 0 });
const cycle = (key: string, completedAt: number) => ({ key, completedAt, correct: 5, incorrect: 0, accuracy: 100, timeMs: 1000, puzzleCount: 10, difficulty: 'easy' });

describe('mergeData', () => {
  it('activity: combine adds the days up, reconcile keeps the larger number', () => {
    const a = { '2026-11-01': day(2, 10), '2026-11-02': day(1, 3) };
    const b = { '2026-11-01': day(3, 4), '2026-11-03': day(1, 1) };
    const sum = mergeData('activity', a, b, 'combine') as Record<string, { sessions: number; correct: number }>;
    assert.equal(sum['2026-11-01'].sessions, 5);
    assert.equal(sum['2026-11-01'].correct, 14);
    assert.deepEqual(Object.keys(sum), ['2026-11-01', '2026-11-02', '2026-11-03']);
    const max = mergeData('activity', a, b, 'reconcile') as Record<string, { sessions: number }>;
    assert.equal(max['2026-11-01'].sessions, 3);
  });
  it('activity: putting the same data together again changes nothing (reconcile)', () => {
    const a = { '2026-11-01': day(2, 10) };
    const once = mergeData('activity', a, a, 'reconcile');
    assert.equal(serialize(once), serialize(a));
    assert.equal(serialize(mergeData('activity', once, a, 'reconcile')), serialize(a));
  });
  it('activity: ignores junk days and fields', () => {
    const merged = mergeData('activity', { 'not-a-day': day(1), '2026-11-01': { sessions: 'x', ms: -5 } }, null, 'combine') as Record<string, Record<string, number>>;
    assert.deepEqual(Object.keys(merged), ['2026-11-01']);
    assert.equal(merged['2026-11-01'].sessions, 0);
    assert.equal(merged['2026-11-01'].ms, 0);
  });
  it('history: union by key, oldest first, no duplicates', () => {
    const merged = mergeData('history', [cycle('a:1', 30), cycle('b:1', 10)], [cycle('a:1', 30), cycle('c:1', 20)], 'combine') as Array<{ key: string }>;
    assert.deepEqual(merged.map((r) => r.key), ['b:1', 'c:1', 'a:1']);
  });
  it('bests: the larger number wins, for a number and for a map', () => {
    assert.equal(mergeData('best-number', 7, 12, 'combine'), 12);
    assert.equal(mergeData('best-number', null, 3, 'combine'), 3);
    assert.deepEqual(mergeData('best-map', { '60': 5, '180': 9 }, { '60': 8, '300': 2 }, 'combine'), { '180': 9, '300': 2, '60': 8 });
  });
  it('serialize gives the same text whatever the order of the keys', () => {
    assert.equal(serialize({ b: 1, a: { d: 1, c: 2 } }), serialize({ a: { c: 2, d: 1 }, b: 1 }));
  });
});

describe('the sync client', () => {
  const session: AuthSession = { accessToken: 'tok', refreshToken: 'r', expiresAt: 9e9, userId: 'u1', email: 'a@b.c' };
  it('reads every key of the account', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createSyncClient({
      url: 'https://x.supabase.co/', key: 'KEY',
      fetch: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json([{ key: 'k1', value: { a: 1 } }, { key: 'k2', value: 5 }]); }) as unknown as typeof fetch,
    });
    const result = await client.fetchAll(session);
    assert.deepEqual(result, { ok: true, value: { k1: { a: 1 }, k2: 5 } });
    assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/user_data?select=key,value&user_id=eq.u1');
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer tok');
    assert.equal((calls[0].init.headers as Record<string, string>).apikey, 'KEY');
  });
  it('saves rows with an upsert', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createSyncClient({ url: 'https://x.supabase.co', key: 'KEY', fetch: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status: 201 }); }) as unknown as typeof fetch });
    assert.deepEqual(await client.save(session, { k1: [1], k2: 2 }), { ok: true, value: true });
    assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/user_data?on_conflict=user_id,key');
    assert.equal(calls[0].init.method, 'POST');
    assert.match(String((calls[0].init.headers as Record<string, string>).Prefer), /merge-duplicates/);
    const rows = JSON.parse(String(calls[0].init.body)) as Array<{ user_id: string; key: string; value: unknown }>;
    assert.deepEqual(rows.map((r) => [r.user_id, r.key, r.value]), [['u1', 'k1', [1]], ['u1', 'k2', 2]]);
  });
  it('saving nothing makes no request', async () => {
    let called = false;
    const client = createSyncClient({ url: 'https://x.supabase.co', key: 'k', fetch: (async () => { called = true; return new Response(null); }) as unknown as typeof fetch });
    assert.equal((await client.save(session, {})).ok, true);
    assert.equal(called, false);
  });
  it('tells a missing table, an ended session and a network failure apart', async () => {
    const make = (response: () => Response | Promise<Response>) => createSyncClient({ url: 'https://x.supabase.co', key: 'k', fetch: (async () => response()) as unknown as typeof fetch });
    const missing = await make(() => Response.json({ message: 'relation does not exist' }, { status: 404 })).fetchAll(session);
    assert.ok(!missing.ok && /not set up/.test(missing.error));
    const ended = await make(() => Response.json({}, { status: 401 })).fetchAll(session);
    assert.ok(!ended.ok && ended.rejected === true);
    const offline = await make(() => { throw new Error('offline'); }).save(session, { a: 1 });
    assert.ok(!offline.ok && /reach/.test(offline.error));
  });
});

// ---- the engine, with a fake storage and a fake account ----

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: StorageLike = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
  return { storage, map };
}

function fakeAccount() {
  const rows = new Map<string, RemoteData>(); // userId -> key -> value
  const log: string[] = [];
  const failures = { read: false, save: false };
  const client = {
    async fetchAll(s: AuthSession) {
      log.push('read');
      if (failures.read) return { ok: false as const, error: 'Could not reach the server to read your results.' };
      return { ok: true as const, value: { ...(rows.get(s.userId) ?? {}) } };
    },
    async save(s: AuthSession, values: RemoteData) {
      log.push(`save:${Object.keys(values).sort().join(',')}`);
      if (failures.save) return { ok: false as const, error: 'Could not reach the server to save your results.' };
      // like jsonb: key order is not kept
      rows.set(s.userId, { ...(rows.get(s.userId) ?? {}), ...JSON.parse(JSON.stringify(values)) });
      return { ok: true as const, value: true as const };
    },
  } as unknown as SyncClient;
  return { rows, log, failures, client };
}

const user = (id: string): AuthSession => ({ accessToken: `tok-${id}`, refreshToken: 'r', expiresAt: 9e9, userId: id, email: `${id}@x.y` });

function setup(local: Record<string, unknown> = {}, session: AuthSession | null = user('u1')) {
  const store = fakeStorage(Object.fromEntries(Object.entries(local).map(([k, v]) => [k, JSON.stringify(v)])));
  const account = fakeAccount();
  let current = session;
  const engine = createSyncEngine({ client: account.client, storage: store.storage, getSession: () => current });
  return { ...store, ...account, engine, signIn: (s: AuthSession | null) => { current = s; } };
}

const read = (map: Map<string, string>, key: string) => JSON.parse(map.get(key) ?? 'null');

describe('the sync engine', () => {
  it('results made as a guest go to a new account, and stay here', async () => {
    const t = setup({ [ACTIVITY]: { '2026-11-01': day(2, 7) }, [STREAK]: 9 });
    await t.engine.syncNow();
    assert.equal(t.engine.getState().status, 'saved');
    assert.deepEqual(t.rows.get('u1')?.[ACTIVITY], { '2026-11-01': day(2, 7) });
    assert.equal(t.rows.get('u1')?.[STREAK], 9);
    assert.deepEqual(read(t.map, ACTIVITY), { '2026-11-01': day(2, 7) });
    assert.equal(t.engine.hasUnsaved(), false);
  });

  it('guest results are added to the ones an account already has (combine), once', async () => {
    const t = setup({ [ACTIVITY]: { '2026-11-01': day(2, 7) }, [RACE]: { '60': 4 } });
    t.rows.set('u1', { [ACTIVITY]: { '2026-11-01': day(3, 1), '2026-10-31': day(1, 1) }, [RACE]: { '60': 9 } });
    await t.engine.syncNow();
    const merged = read(t.map, ACTIVITY);
    assert.equal(merged['2026-11-01'].sessions, 5);
    assert.equal(merged['2026-10-31'].sessions, 1);
    assert.equal(read(t.map, RACE)['60'], 9);
    assert.equal((t.rows.get('u1')?.[ACTIVITY] as Record<string, { sessions: number }>)['2026-11-01'].sessions, 5);
    // syncing again changes nothing and saves nothing
    t.log.length = 0;
    const version = t.engine.getState().version;
    await t.engine.syncNow();
    assert.deepEqual(t.log, ['read']);
    assert.equal(t.engine.getState().version, version);
    assert.equal(read(t.map, ACTIVITY)['2026-11-01'].sessions, 5);
  });

  it('a new device gets the results of the account and says so (version)', async () => {
    const t = setup();
    t.rows.set('u1', { [HISTORY]: [cycle('a:1', 5)], [STREAK]: 12 });
    const before = t.engine.getState().version;
    await t.engine.syncNow();
    assert.equal(read(t.map, STREAK), 12);
    assert.equal(read(t.map, HISTORY).length, 1);
    assert.equal(t.engine.getState().version, before + 1);
    assert.deepEqual(t.log, ['read']);
  });

  it('a result made after the sync is saved by the next one (and only that key)', async () => {
    const t = setup({ [STREAK]: 3 });
    await t.engine.syncNow();
    assert.equal(t.engine.hasUnsaved(), false);
    t.map.set(STREAK, '8');
    assert.equal(t.engine.hasUnsaved(), true);
    t.log.length = 0;
    await t.engine.syncNow();
    assert.deepEqual(t.log, ['read', `save:${STREAK}`]);
    assert.equal(t.rows.get('u1')?.[STREAK], 8);
    assert.equal(t.engine.hasUnsaved(), false);
  });

  it('a better result from another device arrives, and a worse one never replaces the local best', async () => {
    const t = setup({ [STREAK]: 10 });
    await t.engine.syncNow();
    t.rows.set('u1', { ...t.rows.get('u1'), [STREAK]: 15 });
    await t.engine.syncNow();
    assert.equal(read(t.map, STREAK), 15);
    t.rows.set('u1', { ...t.rows.get('u1'), [STREAK]: 4 });
    await t.engine.syncNow();
    assert.equal(read(t.map, STREAK), 15);
    assert.equal(t.rows.get('u1')?.[STREAK], 15, 'the account is brought back up to the best too');
  });

  it('when saving fails nothing changes here, and trying again does not count results twice', async () => {
    const t = setup({ [ACTIVITY]: { '2026-11-01': day(2, 7) } });
    t.rows.set('u1', { [ACTIVITY]: { '2026-11-01': day(3, 1) } });
    t.failures.save = true;
    await t.engine.syncNow();
    assert.equal(t.engine.getState().status, 'error');
    assert.match(t.engine.getState().error, /save/);
    assert.equal(read(t.map, ACTIVITY)['2026-11-01'].sessions, 2, 'local data untouched');
    assert.equal(t.engine.hasUnsaved(), true);
    t.failures.save = false;
    await t.engine.syncNow();
    assert.equal(t.engine.getState().status, 'saved');
    assert.equal(read(t.map, ACTIVITY)['2026-11-01'].sessions, 5);
    await t.engine.syncNow();
    assert.equal(read(t.map, ACTIVITY)['2026-11-01'].sessions, 5);
    assert.equal((t.rows.get('u1')?.[ACTIVITY] as Record<string, { sessions: number }>)['2026-11-01'].sessions, 5);
  });

  it('when reading fails the state says so and nothing is touched', async () => {
    const t = setup({ [STREAK]: 3 });
    t.failures.read = true;
    await t.engine.syncNow();
    assert.equal(t.engine.getState().status, 'error');
    assert.equal(read(t.map, STREAK), 3);
    assert.equal(t.rows.size, 0);
  });

  it('signing out: what is on the account is removed from this browser', async () => {
    const t = setup({ [ACTIVITY]: { '2026-11-01': day(2, 7) }, [STREAK]: 9 });
    await t.engine.syncNow();
    t.signIn(null);
    t.engine.becomeGuest();
    for (const key of SYNCED_KEYS) assert.equal(t.map.get(key), undefined, key);
    assert.equal(t.map.get('ctg_sync_v1'), undefined);
    assert.equal(t.engine.getState().status, 'off');
    // the account still has everything
    assert.equal(t.rows.get('u1')?.[STREAK], 9);
  });

  it('signing out with results that could not be saved keeps them as the guest\'s own, and the next account gets them', async () => {
    const t = setup({ [STREAK]: 9 });
    await t.engine.syncNow();
    t.map.set(STREAK, '20'); // a new record that was not saved
    t.map.set(RACE, JSON.stringify({ '60': 3 })); // another one
    t.signIn(null);
    t.engine.becomeGuest();
    assert.equal(read(t.map, STREAK), 20, 'unsaved result kept');
    assert.equal(read(t.map, RACE)['60'], 3);
    // someone else signs in on this browser
    t.signIn(user('u2'));
    await t.engine.syncNow();
    assert.equal(t.rows.get('u2')?.[STREAK], 20);
    assert.deepEqual(t.rows.get('u2')?.[RACE], { '60': 3 });
    assert.equal(t.rows.get('u1')?.[STREAK], 9, 'the first account is not touched');
  });

  it('signing out with unsaved results and signing in to the SAME account again does not count anything twice', async () => {
    const t = setup({ [ACTIVITY]: { '2026-11-01': day(2, 7) } });
    await t.engine.syncNow();
    // 3 more puzzles solved, not on the account yet
    t.map.set(ACTIVITY, JSON.stringify({ '2026-11-01': day(5, 10) }));
    t.signIn(null);
    t.engine.becomeGuest();
    t.signIn(user('u1'));
    await t.engine.syncNow();
    assert.deepEqual(read(t.map, ACTIVITY), { '2026-11-01': day(5, 10) });
    assert.deepEqual(t.rows.get('u1')?.[ACTIVITY], { '2026-11-01': day(5, 10) });
    // and again: sign out, sign in, nothing is added each time
    for (let i = 0; i < 3; i++) {
      t.map.set(ACTIVITY, JSON.stringify({ '2026-11-01': day(5 + i + 1, 10 + i + 1) }));
      t.signIn(null);
      t.engine.becomeGuest();
      t.signIn(user('u1'));
      await t.engine.syncNow();
    }
    assert.deepEqual(read(t.map, ACTIVITY), { '2026-11-01': day(8, 13) });
    assert.deepEqual(t.rows.get('u1')?.[ACTIVITY], { '2026-11-01': day(8, 13) });
  });

  it('signing out while the results are still being saved does not count them twice at the next sign-in', async () => {
    const t = setup({ [ACTIVITY]: { '2026-11-01': day(2, 7) } });
    await t.engine.syncNow();
    t.map.set(ACTIVITY, JSON.stringify({ '2026-11-01': day(5, 10) }));
    // a slow account: the save is still on its way when the visitor signs out
    const realSave = t.client.save.bind(t.client);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    (t.client as { save: typeof t.client.save }).save = async (s, v, o) => { await gate; return realSave(s, v, o); };
    const running = t.engine.syncNow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.signIn(null);
    t.engine.becomeGuest();
    release();
    await running;
    t.signIn(user('u1'));
    await t.engine.syncNow();
    assert.deepEqual(read(t.map, ACTIVITY), { '2026-11-01': day(5, 10) });
    assert.deepEqual(t.rows.get('u1')?.[ACTIVITY], { '2026-11-01': day(5, 10) });
  });

  it('another account signing in on a browser that was not signed out cleanly does not get the first account\'s results', async () => {
    const t = setup({ [ACTIVITY]: { '2026-11-01': day(2, 7) } });
    await t.engine.syncNow();
    t.signIn(user('u2'));
    await t.engine.syncNow();
    assert.equal(t.map.get(ACTIVITY), undefined);
    assert.equal(t.rows.get('u2')?.[ACTIVITY], undefined);
    assert.ok(t.rows.get('u1')?.[ACTIVITY]);
  });

  it('a result written while the account is being written is kept, and saved next time', async () => {
    const t = setup({ [STREAK]: 3 });
    await t.engine.syncNow();
    t.map.set(STREAK, '5'); // a record that has to be saved
    t.rows.set('u1', { ...t.rows.get('u1'), [RACE]: { '60': 2 } });
    const original = t.client.save.bind(t.client);
    (t.client as { save: unknown }).save = async (s: AuthSession, values: RemoteData) => {
      const result = await original(s, values);
      t.map.set(STREAK, '11'); // an even better record is set while waiting
      return result;
    };
    await t.engine.syncNow();
    assert.equal(read(t.map, STREAK), 11, 'the new record is not overwritten');
    assert.deepEqual(read(t.map, RACE), { '60': 2 }, 'the other device\'s result arrived');
    assert.equal(t.engine.hasUnsaved(), true, 'the new record still has to be saved');
    (t.client as { save: unknown }).save = original;
    await t.engine.syncNow();
    assert.equal(t.rows.get('u1')?.[STREAK], 11);
    assert.equal(t.engine.hasUnsaved(), false);
  });

  it('nothing happens without a signed-in visitor', async () => {
    const t = setup({ [STREAK]: 3 }, null);
    await t.engine.syncNow();
    assert.deepEqual(t.log, []);
    assert.equal(t.engine.hasUnsaved(), false);
  });

  it('fingerprint tells different texts apart', () => {
    assert.notEqual(fingerprint('{"a":1}'), fingerprint('{"a":2}'));
    assert.equal(fingerprint(null), '');
  });
});
