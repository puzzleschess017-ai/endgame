import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAuthClient, describeAuthError, validateCredentials, type AuthSession } from './client.ts';
import { AUTH_STORAGE_KEY, createAuthStore, nameFor } from './store.ts';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A fake `fetch`: answers come from `route(call)`; every call is recorded. */
function fakeFetch(route: (call: Call) => { status?: number; body?: unknown } | 'network') {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      url: String(url),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const answer = route(call);
    if (answer === 'network') throw new TypeError('Failed to fetch');
    const status = answer.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => answer.body ?? null } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

const NOW = 1_000_000;
const sessionBody = (extra: Record<string, unknown> = {}) => ({
  access_token: 'AT',
  refresh_token: 'RT',
  expires_in: 3600,
  user: { id: 'u1', email: 'ana@example.com' },
  ...extra,
});

function clientWith(route: Parameters<typeof fakeFetch>[0]) {
  const f = fakeFetch(route);
  return { client: createAuthClient({ url: 'https://x.supabase.co/', key: 'PUB', fetch: f.impl }, () => NOW), calls: f.calls };
}

describe('validateCredentials', () => {
  it('wants a plausible email and at least 6 characters', () => {
    assert.equal(validateCredentials('ana@example.com', 'secret1'), null);
    assert.match(validateCredentials('ana', 'secret1')!, /valid email/);
    assert.match(validateCredentials('ana@example.com', '123')!, /at least 6/);
  });
});

describe('describeAuthError', () => {
  it('words the common failures', () => {
    assert.equal(describeAuthError(400, { error_code: 'invalid_credentials' }), 'Wrong email or password.');
    assert.match(describeAuthError(400, { error_code: 'email_not_confirmed' }), /confirm your email/);
    assert.match(describeAuthError(422, { error_code: 'user_already_exists' }), /already exists/);
    assert.match(describeAuthError(422, { error_code: 'weak_password' }), /too weak/);
    assert.match(describeAuthError(429, { error_code: 'over_email_send_rate_limit' }), /Too many/);
    assert.match(describeAuthError(429, {}), /Too many/);
    assert.equal(describeAuthError(400, { msg: 'Invalid login credentials' }), 'Wrong email or password.');
    assert.match(describeAuthError(500, null), /Something went wrong/);
  });
});

describe('client', () => {
  it('signIn sends the key and the password and reads the session', async () => {
    const { client, calls } = clientWith(() => ({ body: sessionBody() }));
    const result = await client.signIn({ email: ' ana@example.com ', password: 'secret1' });
    assert.ok(result.ok);
    assert.deepEqual(result.ok && result.value, { accessToken: 'AT', refreshToken: 'RT', expiresAt: NOW + 3600, userId: 'u1', email: 'ana@example.com' });
    assert.equal(calls[0].url, 'https://x.supabase.co/auth/v1/token?grant_type=password');
    assert.equal(calls[0].headers.apikey, 'PUB');
    assert.deepEqual(calls[0].body, { email: 'ana@example.com', password: 'secret1' });
  });
  it('signIn refuses bad input without calling the server', async () => {
    const { client, calls } = clientWith(() => ({ body: sessionBody() }));
    const result = await client.signIn({ email: 'nope', password: 'secret1' });
    assert.equal(result.ok, false);
    assert.equal(calls.length, 0);
  });
  it('signIn reports a wrong password and a network failure differently', async () => {
    const wrong = await clientWith(() => ({ status: 400, body: { error_code: 'invalid_credentials' } })).client.signIn({ email: 'a@b.co', password: 'secret1' });
    assert.deepEqual([wrong.ok, !wrong.ok && wrong.error, !wrong.ok && wrong.rejected], [false, 'Wrong email or password.', true]);
    const down = await clientWith(() => 'network').client.signIn({ email: 'a@b.co', password: 'secret1' });
    assert.deepEqual([down.ok, !down.ok && down.network], [false, true]);
  });
  it('signUp sends the name and returns a session when no confirmation is needed', async () => {
    const { client, calls } = clientWith(() => ({ body: sessionBody() }));
    const result = await client.signUp({ email: 'ana@example.com', password: 'secret1', name: ' Ana ' });
    assert.ok(result.ok && result.value.session);
    assert.deepEqual(calls[0].body, { email: 'ana@example.com', password: 'secret1', data: { name: 'Ana' } });
  });
  it('signUp with email confirmation returns no session', async () => {
    const { client } = clientWith(() => ({ body: { id: 'u1', email: 'ana@example.com', identities: [{ id: 'i' }] } }));
    const result = await client.signUp({ email: 'ana@example.com', password: 'secret1', name: 'Ana' });
    assert.deepEqual(result.ok && result.value, { session: null });
  });
  it('signUp for an address that is already registered is refused', async () => {
    const { client } = clientWith(() => ({ body: { id: 'u1', email: 'ana@example.com', identities: [] } }));
    const result = await client.signUp({ email: 'ana@example.com', password: 'secret1', name: 'Ana' });
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.error : '', /already exists/);
  });
  it('refresh tells a dead token from a busy server', async () => {
    const dead = await clientWith(() => ({ status: 400, body: { error_code: 'refresh_token_not_found' } })).client.refresh('RT');
    assert.deepEqual([dead.ok, !dead.ok && dead.rejected], [false, true]);
    const busy = await clientWith(() => ({ status: 503 })).client.refresh('RT');
    assert.deepEqual([busy.ok, !busy.ok && busy.network, !busy.ok && busy.rejected], [false, true, undefined]);
    const good = await clientWith(() => ({ body: sessionBody({ access_token: 'AT2' }) })).client.refresh('RT');
    assert.equal(good.ok && good.value.accessToken, 'AT2');
  });
  it('fetchProfile reads name and plan with the visitor token; a missing row means free', async () => {
    const session: AuthSession = { accessToken: 'AT', refreshToken: 'RT', expiresAt: NOW + 1, userId: 'u 1', email: 'a@b.co' };
    const { client, calls } = clientWith(() => ({ body: [{ name: 'Ana', tier: 'premium' }] }));
    const premium = await client.fetchProfile(session);
    assert.deepEqual(premium.ok && premium.value, { name: 'Ana', plan: 'premium' });
    assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/profiles?select=name,tier&id=eq.u%201');
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
    const none = await clientWith(() => ({ body: [] })).client.fetchProfile(session);
    assert.deepEqual(none.ok && none.value, { name: '', plan: 'free' });
    const odd = await clientWith(() => ({ body: [{ name: 'Ana', tier: 'admin' }] })).client.fetchProfile(session);
    assert.equal(odd.ok && odd.value.plan, 'free');
    const expired = await clientWith(() => ({ status: 401 })).client.fetchProfile(session);
    assert.deepEqual([expired.ok, !expired.ok && expired.rejected], [false, true]);
  });
});

/** In-memory storage and a manual clock/timer for the store. */
function harness(route: Parameters<typeof fakeFetch>[0], saved?: string) {
  const f = fakeFetch(route);
  const data = new Map<string, string>(saved ? [[AUTH_STORAGE_KEY, saved]] : []);
  let nowSeconds = NOW;
  const timers: Array<{ fn: () => void; ms: number; id: number; live: boolean }> = [];
  const store = createAuthStore({
    client: createAuthClient({ url: 'https://x.supabase.co', key: 'PUB', fetch: f.impl }, () => nowSeconds),
    storage: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) },
    now: () => nowSeconds,
    setTimer: (fn, ms) => {
      const t = { fn, ms, id: timers.length, live: true };
      timers.push(t);
      return t.id;
    },
    clearTimer: (id) => {
      const t = timers[id as number];
      if (t) t.live = false;
    },
  });
  return { store, data, calls: f.calls, timers, advance: (s: number) => (nowSeconds += s) };
}

const profileFor = (tier: string) => ({ body: [{ name: 'Ana', tier }] });

describe('store', () => {
  it('starts as a guest', async () => {
    const h = harness(() => ({ status: 500 }));
    await h.store.init();
    assert.deepEqual([h.store.getState().tier, h.store.getState().status, h.store.getState().name], ['guest', 'ready', '']);
  });
  it('signing in makes the visitor "free" or "premium" by their profile, and remembers it', async () => {
    const h = harness((c) => (c.url.includes('/auth/v1/token') ? { body: sessionBody() } : profileFor('premium')));
    const result = await h.store.signIn('ana@example.com', 'secret1');
    assert.ok(result.ok);
    const s = h.store.getState();
    assert.deepEqual([s.tier, s.status, s.name], ['premium', 'ready', 'Ana']);
    assert.ok(h.data.get(AUTH_STORAGE_KEY)?.includes('"plan":"premium"'));
  });
  it('a failed sign-in leaves the visitor a guest', async () => {
    const h = harness(() => ({ status: 400, body: { error_code: 'invalid_credentials' } }));
    const result = await h.store.signIn('ana@example.com', 'secret1');
    assert.equal(result.ok, false);
    assert.equal(h.store.getState().tier, 'guest');
    assert.equal(h.data.size, 0);
  });
  it('sign-up that needs email confirmation signs nobody in', async () => {
    const h = harness(() => ({ body: { id: 'u1', identities: [{}] } }));
    const result = await h.store.signUp('ana@example.com', 'secret1', 'Ana');
    assert.deepEqual(result.ok && result.value, { session: null });
    assert.equal(h.store.getState().tier, 'guest');
  });
  it('sign-up without confirmation signs the visitor in as free', async () => {
    const h = harness((c) => (c.url.includes('/auth/v1/signup') ? { body: sessionBody() } : profileFor('free')));
    await h.store.signUp('ana@example.com', 'secret1', 'Ana');
    assert.deepEqual([h.store.getState().tier, h.store.getState().name], ['free', 'Ana']);
  });
  it('signing out clears the browser even if the server cannot be reached', async () => {
    const h = harness((c) => (c.url.includes('/auth/v1/token') ? { body: sessionBody() } : c.url.includes('logout') ? 'network' : profileFor('free')));
    await h.store.signIn('ana@example.com', 'secret1');
    await h.store.signOut();
    assert.equal(h.store.getState().tier, 'guest');
    assert.equal(h.data.size, 0);
  });
  it('a saved sign-in is used at once (no flicker) and then checked', async () => {
    const saved = JSON.stringify({ session: { accessToken: 'AT', refreshToken: 'RT', expiresAt: NOW + 3600, userId: 'u1', email: 'ana@example.com' }, profile: { name: 'Ana', plan: 'premium' } });
    const h = harness(() => profileFor('free'), saved);
    const seen: string[] = [];
    h.store.subscribe(() => seen.push(h.store.getState().tier));
    await h.store.init();
    assert.equal(seen[0], 'premium'); // from the saved copy
    assert.equal(h.store.getState().tier, 'free'); // the server says the plan ended
  });
  it('an expired token is refreshed; a dead refresh token signs the visitor out', async () => {
    const saved = JSON.stringify({ session: { accessToken: 'OLD', refreshToken: 'RT', expiresAt: NOW - 10, userId: 'u1', email: 'ana@example.com' }, profile: { name: 'Ana', plan: 'free' } });
    const good = harness((c) => (c.url.includes('grant_type=refresh_token') ? { body: sessionBody({ access_token: 'NEW' }) } : profileFor('free')), saved);
    await good.store.init();
    assert.equal(good.store.getState().session?.accessToken, 'NEW');
    const dead = harness((c) => (c.url.includes('grant_type=refresh_token') ? { status: 400, body: {} } : profileFor('free')), saved);
    await dead.store.init();
    assert.equal(dead.store.getState().tier, 'guest');
    assert.equal(dead.data.size, 0);
  });
  it('a server that is down keeps the saved sign-in and retries later', async () => {
    const saved = JSON.stringify({ session: { accessToken: 'OLD', refreshToken: 'RT', expiresAt: NOW - 10, userId: 'u1', email: 'ana@example.com' }, profile: { name: 'Ana', plan: 'premium' } });
    const h = harness(() => 'network', saved);
    await h.store.init();
    assert.deepEqual([h.store.getState().tier, h.store.getState().status], ['premium', 'ready']);
    assert.ok(h.timers.some((t) => t.live && t.ms === 30_000));
  });
  it('schedules a refresh before the token ends', async () => {
    const h = harness((c) => (c.url.includes('/auth/v1/token') ? { body: sessionBody() } : profileFor('free')));
    await h.store.signIn('ana@example.com', 'secret1');
    const live = h.timers.filter((t) => t.live);
    assert.equal(live.length, 1);
    assert.equal(live[0].ms, (3600 - 90) * 1000);
  });
  it('junk in storage means guest', async () => {
    const h = harness(() => ({ status: 500 }), 'not json');
    await h.store.init();
    assert.equal(h.store.getState().tier, 'guest');
  });
  it('rename changes the name shown and keeps the plan', async () => {
    const h = harness((c) => (c.url.includes('/auth/v1/token') ? { body: sessionBody() } : c.method === 'PATCH' ? { status: 204 } : profileFor('premium')));
    await h.store.signIn('ana@example.com', 'secret1');
    const result = await h.store.rename(' Anja ');
    assert.ok(result.ok);
    assert.deepEqual([h.store.getState().name, h.store.getState().tier], ['Anja', 'premium']);
  });
  it('nameFor falls back to the start of the email', () => {
    const s: AuthSession = { accessToken: 'a', refreshToken: 'r', expiresAt: 1, userId: 'u', email: 'ana.k@example.com' };
    assert.equal(nameFor(s, null), 'ana.k');
    assert.equal(nameFor(s, { name: '  ', plan: 'free' }), 'ana.k');
    assert.equal(nameFor(null, null), '');
  });
});
