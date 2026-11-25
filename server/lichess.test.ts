import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { callbackUrl, createLichessLogin, readCookieHeader, safeNext, COOKIE_NAME } from './lichess.ts';

const REDIRECT = 'https://site.test/api/auth/lichess/callback';
const SERVICE_KEY = 'eyJ.service.key';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

interface Fake {
  lichessToken?: boolean;
  account?: Record<string, unknown> | null;
  createStatus?: number;
  linkOk?: boolean;
  verifyTypes?: string[]; // the types Supabase accepts
}

function fake(options: Fake = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : '',
    };
    calls.push(call);
    if (url === 'https://lichess.org/api/token' && call.method === 'POST') {
      return options.lichessToken === false ? new Response('{}', { status: 400 }) : Response.json({ token_type: 'Bearer', access_token: 'lip_abc', expires_in: 1000 });
    }
    if (url === 'https://lichess.org/api/token' && call.method === 'DELETE') return new Response(null, { status: 204 });
    if (url === 'https://lichess.org/api/account') {
      return options.account === null ? new Response('{}', { status: 401 }) : Response.json(options.account ?? { id: 'magnus', username: 'Magnus' });
    }
    if (url.endsWith('/auth/v1/admin/users')) return Response.json({ id: 'u1' }, { status: options.createStatus ?? 200 });
    if (url.endsWith('/auth/v1/admin/generate_link')) {
      return options.linkOk === false ? new Response('{}', { status: 500 }) : Response.json({ hashed_token: 'hash123' });
    }
    if (url.endsWith('/auth/v1/verify')) {
      const type = (JSON.parse(call.body) as { type: string }).type;
      if (!(options.verifyTypes ?? ['magiclink']).includes(type)) return new Response('{}', { status: 400 });
      return Response.json({ access_token: 'AT', refresh_token: 'RT', expires_at: 2000, expires_in: 3600, user: { id: 'u-123', email: 'lichess-x@lichess.site.test' } });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function make(options: Fake = {}, extra: { serviceKey?: string | undefined; now?: () => number } = {}) {
  const f = fake(options);
  const login = createLichessLogin({
    supabaseUrl: 'https://x.supabase.co/',
    supabaseKey: 'PUBLIC',
    serviceKey: 'serviceKey' in extra ? extra.serviceKey : SERVICE_KEY,
    emailDomain: 'lichess.site.test',
    fetchImpl: f.fetchImpl,
    now: extra.now ?? (() => 1000),
  });
  return { login, ...f };
}

/** Starts a flow and returns the cookie header and the state Lichess would send back. */
function started(login: ReturnType<typeof make>['login'], next: unknown = '/streak') {
  const start = login.start(next, REDIRECT);
  assert.ok(start.ok);
  const state = new URL(start.url).searchParams.get('state')!;
  return { start, state, cookie: `${COOKIE_NAME}=${start.cookie}` };
}

const cookieValue = (header: string) => readCookieHeader(header, COOKIE_NAME);

describe('helpers', () => {
  it('safeNext only lets paths of this site through', () => {
    assert.equal(safeNext('/streak'), '/streak');
    assert.equal(safeNext('/endgames/lucena-position'), '/endgames/lucena-position');
    for (const bad of ['//evil.com', 'https://evil.com', 'streak', '/a?b=c', '/a#b', undefined, 5]) assert.equal(safeNext(bad), '/');
  });
  it('callbackUrl joins the origin and the callback path', () => {
    assert.equal(callbackUrl('https://site.test/'), REDIRECT);
  });
  it('readCookieHeader finds one cookie among others', () => {
    assert.equal(readCookieHeader('a=1; ctg_lichess=x.y; b=2', 'ctg_lichess'), 'x.y');
    assert.equal(readCookieHeader(undefined, 'a'), undefined);
  });
});

describe('start', () => {
  it('is off without the service key', () => {
    const { login } = make({}, { serviceKey: undefined });
    assert.equal(login.enabled, false);
    assert.deepEqual(login.start('/', REDIRECT), { ok: false, error: 'unavailable' });
  });

  it('sends the visitor to Lichess with a PKCE challenge and a state, and remembers them in a signed cookie', () => {
    const { login } = make();
    const { start, state } = started(login);
    const url = new URL(start.url);
    assert.equal(url.origin + url.pathname, 'https://lichess.org/oauth');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('redirect_uri'), REDIRECT);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(state.length >= 16);
    // The challenge is the hash of the verifier in the cookie.
    const body = JSON.parse(Buffer.from(start.cookie.split('.')[0], 'base64url').toString()) as { verifier: string; state: string; next: string };
    assert.equal(body.state, state);
    assert.equal(body.next, '/streak');
    assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(body.verifier).digest('base64url'));
    assert.equal(start.maxAge, 600);
  });

  it('two starts never share a state', () => {
    const { login } = make();
    assert.notEqual(started(login).state, started(login).state);
  });
});

describe('finish', () => {
  it('a good return: swaps the code, reads the name, signs the account in and sends the session to /login in the fragment', async () => {
    const { login, calls } = make();
    const { state, cookie } = started(login, '/streak');
    const result = await login.finish({ code: 'CODE', state, cookie: cookieValue(cookie) }, REDIRECT);
    assert.ok(result.ok);
    const [path, fragment] = result.redirect.split('#');
    assert.equal(path, '/login?next=%2Fstreak');
    const params = new URLSearchParams(fragment);
    assert.equal(params.get('access_token'), 'AT');
    assert.equal(params.get('refresh_token'), 'RT');
    assert.equal(params.get('user_id'), 'u-123');

    const token = calls.find((c) => c.url === 'https://lichess.org/api/token' && c.method === 'POST')!;
    const form = new URLSearchParams(token.body);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('code'), 'CODE');
    assert.equal(form.get('redirect_uri'), REDIRECT);
    assert.ok(form.get('code_verifier'));
    assert.ok(!form.has('client_secret'));
    // The Lichess token is given back.
    assert.ok(calls.some((c) => c.url === 'https://lichess.org/api/token' && c.method === 'DELETE'));
  });

  it('makes the account with the secret key, named after the Lichess user, with an address that is not the username', async () => {
    const { login, calls } = make({ account: { id: 'magnus', username: 'MagnusC' } });
    const { state, cookie } = started(login);
    await login.finish({ code: 'C', state, cookie: cookieValue(cookie) }, REDIRECT);
    const create = calls.find((c) => c.url === 'https://x.supabase.co/auth/v1/admin/users')!;
    assert.equal(create.headers.apikey, SERVICE_KEY);
    assert.equal(create.headers.Authorization, `Bearer ${SERVICE_KEY}`);
    const body = JSON.parse(create.body) as { email: string; email_confirm: boolean; user_metadata: { name: string } };
    assert.equal(body.email_confirm, true);
    assert.equal(body.user_metadata.name, 'MagnusC');
    assert.match(body.email, /^lichess-[0-9a-f]{24}@lichess\.site\.test$/);
    assert.ok(!body.email.includes('magnus'));
    assert.ok(login.isLichessEmail(body.email));
    assert.ok(!login.isLichessEmail('someone@gmail.com'));
    // The sign-in swap uses the public key only.
    const verify = calls.find((c) => c.url.endsWith('/auth/v1/verify'))!;
    assert.equal(verify.headers.apikey, 'PUBLIC');
    assert.equal(verify.headers.Authorization, undefined);
  });

  it('the same Lichess user always gets the same address; another user gets another', async () => {
    const addresses: string[] = [];
    for (const id of ['magnus', 'magnus', 'hikaru']) {
      const { login, calls } = make({ account: { id, username: id } });
      const { state, cookie } = started(login);
      await login.finish({ code: 'C', state, cookie: cookieValue(cookie) }, REDIRECT);
      addresses.push((JSON.parse(calls.find((c) => c.url.endsWith('/admin/users'))!.body) as { email: string }).email);
    }
    assert.equal(addresses[0], addresses[1]);
    assert.notEqual(addresses[0], addresses[2]);
  });

  it('a returning visitor (the account exists already) still signs in', async () => {
    const { login } = make({ createStatus: 422 });
    const { state, cookie } = started(login);
    const result = await login.finish({ code: 'C', state, cookie: cookieValue(cookie) }, REDIRECT);
    assert.ok(result.ok);
  });

  it('a project that only knows the type "email" works too, and a secret key that is not a JWT stays out of Authorization', async () => {
    const { login, calls } = make({ verifyTypes: ['email'] }, { serviceKey: 'sb_secret_abc' });
    const { state, cookie } = started(login);
    const result = await login.finish({ code: 'C', state, cookie: cookieValue(cookie) }, REDIRECT);
    assert.ok(result.ok);
    assert.equal(calls.find((c) => c.url.endsWith('/admin/users'))!.headers.Authorization, undefined);
  });

  it('no cookie, a wrong state, a missing code or a tampered or expired cookie: expired, and nothing is asked of Lichess', async () => {
    const { login, calls } = make();
    const { state, cookie } = started(login);
    const value = cookieValue(cookie)!;
    const tampered = value.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    const cases = [
      { code: 'C', state, cookie: undefined },
      { code: 'C', state: 'other', cookie: value },
      { code: undefined, state, cookie: value },
      { code: 'C', state, cookie: tampered },
      { code: 'C', state, cookie: 'garbage' },
    ];
    for (const input of cases) {
      const result = await login.finish(input, REDIRECT);
      assert.ok(!result.ok);
      assert.equal(result.error, 'expired');
    }
    assert.equal(calls.length, 0);

    const later = make({}, { now: () => 5000 });
    const result = await later.login.finish({ code: 'C', state, cookie: value }, REDIRECT); // a cookie signed by another key
    assert.ok(!result.ok);

    let clock = 1000;
    const timed = make({}, { now: () => clock });
    const flow = started(timed.login);
    clock = 1000 + 601;
    const expired = await timed.login.finish({ code: 'C', state: flow.state, cookie: cookieValue(flow.cookie) }, REDIRECT);
    assert.ok(!expired.ok);
    assert.equal(expired.error, 'expired');
  });

  it('the visitor said no on Lichess: cancelled, back to /login with the page they came from', async () => {
    const { login, calls } = make();
    const { state, cookie } = started(login, '/race');
    const result = await login.finish({ error: 'access_denied', state, cookie: cookieValue(cookie) }, REDIRECT);
    assert.ok(!result.ok);
    assert.equal(result.error, 'cancelled');
    assert.equal(result.redirect, '/login?lichess_error=cancelled&next=%2Frace');
    assert.equal(calls.length, 0);
  });

  it('Lichess or Supabase refusing: failed, never a session', async () => {
    for (const options of [{ lichessToken: false }, { account: null }, { linkOk: false }, { verifyTypes: [] }, { account: { id: 'x', username: 'x' } }, { account: { id: 'magnus', closed: true } }]) {
      const { login } = make(options);
      const { state, cookie } = started(login);
      const result = await login.finish({ code: 'C', state, cookie: cookieValue(cookie) }, REDIRECT);
      assert.ok(!result.ok, JSON.stringify(options));
      assert.equal(result.error, 'failed');
      assert.ok(!result.redirect.includes('access_token'));
    }
  });

  it('is off without the service key', async () => {
    const { login } = make({}, { serviceKey: undefined });
    const result = await login.finish({ code: 'C', state: 's', cookie: 'x' }, REDIRECT);
    assert.ok(!result.ok);
    assert.equal(result.error, 'unavailable');
  });
});
