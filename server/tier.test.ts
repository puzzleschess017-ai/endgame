import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTierLookup } from './tier.ts';

const ID = '3f8c2d5e-1a4b-4c6d-8e9f-0a1b2c3d4e5f';

interface Call {
  url: string;
  headers: Record<string, string>;
}

/** A fake Supabase: `tokens` maps a token to a plan; anything else is "expired". */
function fake(tokens: Record<string, 'free' | 'premium' | null>, options: { down?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers });
    if (options.down) throw new Error('offline');
    const token = (headers.Authorization ?? '').replace('Bearer ', '');
    if (!(token in tokens)) return new Response('{}', { status: 401 });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: ID });
    if (url.includes('/rest/v1/profiles')) {
      const tier = tokens[token];
      return Response.json(tier ? [{ tier }] : []);
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('createTierLookup', () => {
  it('no header, or a header that is not a Bearer token: guest, and Supabase is not asked', async () => {
    const { fetchImpl, calls } = fake({});
    const lookup = createTierLookup({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
    assert.deepEqual(await lookup(undefined), { ok: true, tier: 'guest' });
    assert.deepEqual(await lookup(''), { ok: true, tier: 'guest' });
    assert.deepEqual(await lookup('Basic abc'), { ok: true, tier: 'guest' });
    assert.equal(calls.length, 0);
  });

  it('a real token: reads the plan with the key and the user token', async () => {
    const { fetchImpl, calls } = fake({ good: 'premium', plain: 'free' });
    const lookup = createTierLookup({ url: 'https://x.supabase.co/', key: 'KEY', fetchImpl });
    assert.deepEqual(await lookup('Bearer good'), { ok: true, tier: 'premium' });
    assert.deepEqual(await lookup('Bearer plain'), { ok: true, tier: 'free' });
    assert.equal(calls[0].url, 'https://x.supabase.co/auth/v1/user');
    assert.equal(calls[0].headers.apikey, 'KEY');
    assert.equal(calls[0].headers.Authorization, 'Bearer good');
    assert.equal(calls[1].url, `https://x.supabase.co/rest/v1/profiles?select=tier&id=eq.${ID}`);
  });

  it('a token with no profile row counts as free', async () => {
    const { fetchImpl } = fake({ t: null });
    const lookup = createTierLookup({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
    assert.deepEqual(await lookup('Bearer t'), { ok: true, tier: 'free' });
  });

  it('a rejected or expired token is a 401, not a guest', async () => {
    const { fetchImpl } = fake({});
    const lookup = createTierLookup({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
    const result = await lookup('Bearer nope');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.match(result.error, /sign in again/i);
    }
  });

  it('remembers an answer for the time given, then asks again', async () => {
    let time = 1000;
    const { fetchImpl, calls } = fake({ good: 'premium' });
    const lookup = createTierLookup({ url: 'https://x.supabase.co', key: 'k', fetchImpl, now: () => time, ttlMs: 60_000 });
    await lookup('Bearer good');
    await lookup('Bearer good');
    assert.equal(calls.length, 2, 'two requests for the first lookup, none for the second');
    time += 61_000;
    await lookup('Bearer good');
    assert.equal(calls.length, 4);
  });

  it('when Supabase cannot be reached a signed-in visitor counts as free (and is not remembered)', async () => {
    const { fetchImpl, calls } = fake({ good: 'premium' }, { down: true });
    const lookup = createTierLookup({ url: 'https://x.supabase.co', key: 'k', fetchImpl });
    assert.deepEqual(await lookup('Bearer good'), { ok: true, tier: 'free' });
    await lookup('Bearer good');
    assert.equal(calls.length, 2);
  });
});
