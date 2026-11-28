import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import {
  authorizeUrl,
  finishLichessLogin,
  loadLichessSettings,
  newPkce,
  openFlow,
  readCookie,
  safeNext,
  sealFlow,
} from './lichess.ts';

const SITE = 'https://www.chesstacticsguide.com';
const SUPABASE = 'https://x.supabase.co';
const settings = loadLichessSettings({ SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' }, SITE, SUPABASE)!;

describe('settings', () => {
  it('are off without the service key and on with it', () => {
    assert.equal(loadLichessSettings({}, SITE, SUPABASE), null);
    assert.equal(settings.clientId, 'www.chesstacticsguide.com');
    assert.equal(settings.redirectUri, `${SITE}/auth/lichess/callback`);
  });
});

describe('PKCE and the authorize address', () => {
  it('the challenge is the SHA-256 of the verifier, and every start is new', () => {
    const a = newPkce();
    assert.equal(a.challenge, crypto.createHash('sha256').update(a.verifier).digest('base64url'));
    assert.notEqual(a.verifier, newPkce().verifier);
    assert.notEqual(a.state, newPkce().state);
  });
  it('asks Lichess for the code flow with the email scope', () => {
    const pkce = newPkce();
    const url = new URL(authorizeUrl(settings, pkce));
    assert.equal(url.origin + url.pathname, 'https://lichess.org/oauth');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('code_challenge'), pkce.challenge);
    assert.equal(url.searchParams.get('scope'), 'email:read');
    assert.equal(url.searchParams.get('state'), pkce.state);
    assert.equal(url.searchParams.get('redirect_uri'), settings.redirectUri);
  });
});

describe('the cookie of the flow', () => {
  const flow = { verifier: 'v', state: 's', next: '/streak' };
  it('opens what it sealed, for ten minutes', () => {
    const value = sealFlow(settings.cookieKey, flow, 1000);
    assert.deepEqual(openFlow(settings.cookieKey, value, 1100), flow);
    assert.equal(openFlow(settings.cookieKey, value, 1000 + 601), null);
  });
  it('carries the account to link, and only a real account id', () => {
    const value = sealFlow(settings.cookieKey, { ...flow, link: '3f8c2d5e-1a4b-4c6d-8e9f-0a1b2c3d4e5f' }, 1000);
    assert.equal(openFlow(settings.cookieKey, value, 1000)?.link, '3f8c2d5e-1a4b-4c6d-8e9f-0a1b2c3d4e5f');
    const odd = sealFlow(settings.cookieKey, { ...flow, link: 'not-an-id' }, 1000);
    assert.equal(openFlow(settings.cookieKey, odd, 1000)?.link, undefined);
  });
  it('refuses a changed, foreign or empty value', () => {
    const value = sealFlow(settings.cookieKey, flow, 1000);
    const [data, signature] = value.split('.');
    const forged = Buffer.from(JSON.stringify({ ...flow, next: '/x', exp: 99999 })).toString('base64url');
    assert.equal(openFlow(settings.cookieKey, `${forged}.${signature}`, 1000), null);
    assert.equal(openFlow(crypto.randomBytes(32), value, 1000), null);
    assert.equal(openFlow(settings.cookieKey, `${data}.`, 1000), null);
    assert.equal(openFlow(settings.cookieKey, undefined, 1000), null);
    assert.equal(openFlow(settings.cookieKey, 'junk', 1000), null);
  });
  it('reads one cookie of a header, and only goes to a path of this site', () => {
    assert.equal(readCookie('a=1; ctg_lichess=xyz; b=2', 'ctg_lichess'), 'xyz');
    assert.equal(readCookie('a=1', 'ctg_lichess'), undefined);
    assert.equal(safeNext('/streak'), '/streak');
    assert.equal(safeNext('//evil.com'), '/');
    assert.equal(safeNext('https://evil.com'), '/');
    assert.equal(safeNext(undefined), '/');
  });
});

type Answer = { status?: number; body?: unknown };

function fake(route: (url: string, method: string, body: string | undefined) => Answer) {
  const calls: { url: string; method: string; body: string | undefined; headers: Record<string, string> }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? init.body : undefined;
    calls.push({ url: String(url), method, body, headers: (init.headers ?? {}) as Record<string, string> });
    const answer = route(String(url), method, body);
    const status = answer.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => answer.body ?? null } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

const USER_A = '3f8c2d5e-1a4b-4c6d-8e9f-0a1b2c3d4e5f';
const USER_B = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

/** Lichess and Supabase as they answer for a first sign-in (no link yet) of a new person. */
const happy = (url: string, method: string): Answer => {
  if (url.includes('/rest/v1/lichess_links') && method === 'GET') return { body: [] };
  if (url.includes('/rest/v1/lichess_links') && method === 'POST') return { status: 201 };
  if (url === 'https://lichess.org/api/token' && method === 'POST') return { body: { access_token: 'lip_tok' } };
  if (url === 'https://lichess.org/api/token' && method === 'DELETE') return { status: 204 };
  if (url === 'https://lichess.org/api/account') return { body: { username: 'MagnusFan', id: 'magnusfan' } };
  if (url === 'https://lichess.org/api/account/email') return { body: { email: 'Ana@Example.com' } };
  if (url.endsWith('/auth/v1/admin/users')) return { status: 200, body: { id: 'u1' } };
  if (url.endsWith('/auth/v1/admin/generate_link')) return { body: { id: USER_A, hashed_token: 'hash123_-abc', properties: {} } };
  return { status: 404 };
};

describe('finishing the sign-in', () => {
  it('trades the code, reads the account, throws the token away and gives back the one-time token', async () => {
    const f = fake(happy);
    const result = await finishLichessLogin({ code: 'C0DE', verifier: 'VER' }, settings, f.impl);
    assert.deepEqual(result, { ok: true, tokenHash: 'hash123_-abc' });
    const exchange = f.calls.find((c) => c.url === 'https://lichess.org/api/token' && c.method === 'POST')!;
    const sent = new URLSearchParams(exchange.body);
    assert.equal(sent.get('code'), 'C0DE');
    assert.equal(sent.get('code_verifier'), 'VER');
    assert.equal(sent.get('redirect_uri'), settings.redirectUri);
    assert.ok(f.calls.some((c) => c.method === 'DELETE' && c.url === 'https://lichess.org/api/token'), 'the Lichess token is revoked');
    const created = JSON.parse(f.calls.find((c) => c.url.endsWith('/admin/users'))!.body!);
    assert.deepEqual(created, { email: 'ana@example.com', email_confirm: true, user_metadata: { name: 'MagnusFan', lichess: 'MagnusFan' } });
    const link = JSON.parse(f.calls.find((c) => c.url.endsWith('/generate_link'))!.body!);
    assert.deepEqual(link, { type: 'magiclink', email: 'ana@example.com' });
    // the new style secret key goes in apikey only
    const admin = f.calls.find((c) => c.url.endsWith('/admin/users'))!;
    assert.equal(admin.headers.apikey, 'sb_secret_abc');
    assert.equal(admin.headers.Authorization, undefined);
  });
  it('a user that exists already (Supabase refuses to create it again) still gets in', async () => {
    const f = fake((url, method) => (url.endsWith('/admin/users') ? { status: 422, body: { error_code: 'email_exists' } } : happy(url, method)));
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, f.impl), { ok: true, tokenHash: 'hash123_-abc' });
  });
  it('a refused code is "denied"; an account without email is "no_email"', async () => {
    const denied = fake((url, method) => (url === 'https://lichess.org/api/token' && method === 'POST' ? { status: 400, body: { error: 'invalid_grant' } } : happy(url, method)));
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, denied.impl), { ok: false, reason: 'denied' });
    const noEmail = fake((url, method) => (url.endsWith('/account/email') ? { body: { email: null } } : happy(url, method)));
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, noEmail.impl), { ok: false, reason: 'no_email' });
    assert.ok(!noEmail.calls.some((c) => c.url.includes('/auth/v1/')), 'nobody is created without an email');
  });
  it('a username that is not a plain Lichess name is not trusted', async () => {
    const f = fake((url, method) => (url === 'https://lichess.org/api/account' ? { body: { username: '<script>' } } : happy(url, method)));
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, f.impl), { ok: false, reason: 'unavailable' });
  });
  it('a failure of Supabase or of the network is "unavailable"', async () => {
    const down = fake((url, method) => (url.endsWith('/generate_link') ? { status: 500 } : happy(url, method)));
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, down.impl), { ok: false, reason: 'unavailable' });
    const throws = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, throws), { ok: false, reason: 'unavailable' });
  });
  it('the first sign-in remembers which site account the Lichess account opened', async () => {
    const f = fake(happy);
    await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, f.impl);
    const saved = f.calls.find((c) => c.url.includes('/rest/v1/lichess_links') && c.method === 'POST')!;
    assert.deepEqual(JSON.parse(saved.body!), { lichess_id: 'magnusfan', user_id: USER_A, username: 'MagnusFan' });
    assert.match(saved.headers.Prefer, /merge-duplicates/);
  });
  it('a linked Lichess account opens its site account, whatever email either has', async () => {
    const f = fake((url, method) => {
      if (url.includes('/rest/v1/lichess_links') && method === 'GET') return { body: [{ user_id: USER_B }] };
      if (url.endsWith(`/auth/v1/admin/users/${USER_B}`)) return { body: { id: USER_B, email: 'commandos@mail.com' } };
      return happy(url, method);
    });
    const result = await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, f.impl);
    assert.deepEqual(result, { ok: true, tokenHash: 'hash123_-abc' });
    const link = JSON.parse(f.calls.find((c) => c.url.endsWith('/generate_link'))!.body!);
    assert.equal(link.email, 'commandos@mail.com', 'the token is for the linked account, not for the Lichess email');
    assert.ok(!f.calls.some((c) => c.url.endsWith('/auth/v1/admin/users') && c.method === 'POST'), 'no new user is made');
  });
  it('a signed-in person links the Lichess account to theirs, and needs no email at Lichess', async () => {
    const f = fake((url, method) => (url.endsWith('/account/email') ? { body: { email: null } } : happy(url, method)));
    const result = await finishLichessLogin({ code: 'c', verifier: 'v', link: USER_B }, settings, f.impl);
    assert.deepEqual(result, { ok: true, linked: true });
    const saved = f.calls.find((c) => c.url.includes('/rest/v1/lichess_links') && c.method === 'POST')!;
    assert.deepEqual(JSON.parse(saved.body!), { lichess_id: 'magnusfan', user_id: USER_B, username: 'MagnusFan' });
    assert.ok(!f.calls.some((c) => c.url.includes('/auth/v1/')), 'nobody is signed in or created by linking');
  });
  it('linking to an account that has another Lichess account is refused', async () => {
    const f = fake((url, method) => (url.includes('/rest/v1/lichess_links') && method === 'POST' ? { status: 409 } : happy(url, method)));
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v', link: USER_B }, settings, f.impl), { ok: false, reason: 'other_link' });
  });
  it('without the links table the email decides, as before', async () => {
    const f = fake((url, method) => (url.includes('/rest/v1/lichess_links') ? { status: 404 } : happy(url, method)));
    assert.deepEqual(await finishLichessLogin({ code: 'c', verifier: 'v' }, settings, f.impl), { ok: true, tokenHash: 'hash123_-abc' });
  });
});
