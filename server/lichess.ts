// "Sign in with Lichess". Supabase has no Lichess provider, so the server does the OAuth steps itself:
//
//   1. /api/auth/lichess/start     sends the visitor to Lichess (authorization code flow with PKCE; Lichess needs
//                                  no registered app: any client id works) and remembers the state in a signed cookie.
//   2. /api/auth/lichess/callback  Lichess sends the visitor back with a code. The server swaps it for a token, asks
//                                  Lichess who this is (the account name), drops the token, and then asks Supabase
//                                  (with the secret service key) to find or create the account of this Lichess user
//                                  and to hand out a normal sign-in session for it.
//   3. The visitor lands on /login with the session in the address fragment (never sent to a server), and the page
//      saves it exactly like a password sign-in.
//
// The account has no real email: its address is made from the Lichess id with a secret key, so nobody else can
// guess it, and nothing is ever sent to it. Everything here uses an injected `fetch`, so it is tested without a network.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const LICHESS_URL = 'https://lichess.org';
export const COOKIE_NAME = 'ctg_lichess';
export const CALLBACK_PATH = '/api/auth/lichess/callback';
/** How long the visitor has to finish on Lichess. */
const FLOW_SECONDS = 10 * 60;
const CLIENT_ID = 'chess-tactics-guide';

export interface LichessLoginOptions {
  /** Supabase project address and its public ("publishable") key. */
  supabaseUrl: string;
  supabaseKey: string;
  /** The secret key of the Supabase project (service role / secret key). Without it the feature is off. */
  serviceKey: string | undefined;
  /** Domain of the made-up account addresses. */
  emailDomain: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  random?: (size: number) => Buffer;
}

export type Start = { ok: true; url: string; cookie: string; maxAge: number } | { ok: false; error: 'unavailable' };

export type Finish = { ok: true; redirect: string } | { ok: false; redirect: string; error: LichessError };

export type LichessError = 'cancelled' | 'expired' | 'failed' | 'unavailable';

const b64url = (data: Buffer | string): string => Buffer.from(data).toString('base64url');

/** A path of this site the visitor goes to afterwards (given as ?next=). Anything else becomes Home. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(next) ? next : '/';
}

/** The address Lichess sends the visitor back to. A configured SITE_URL wins, else the address the visitor used. */
export function callbackUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${CALLBACK_PATH}`;
}

/** A fragment such as "#access_token=...": what /login reads. */
function sessionFragment(session: Record<string, unknown>, user: { id: string; email: string }): string {
  const params = new URLSearchParams({
    access_token: String(session.access_token),
    refresh_token: String(session.refresh_token),
    expires_at: String(session.expires_at ?? ''),
    expires_in: String(session.expires_in ?? ''),
    user_id: user.id,
    email: user.email,
  });
  return `#${params.toString()}`;
}

export function createLichessLogin(options: LichessLoginOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const random = options.random ?? ((size: number) => randomBytes(size));
  const base = options.supabaseUrl.replace(/\/+$/, '');
  const serviceKey = options.serviceKey?.trim() || undefined;
  const enabled = Boolean(serviceKey);
  // Everything signed or made secret below is derived from the service key, so there is nothing more to set up.
  const secret = serviceKey ? createHash('sha256').update(`ctg-lichess:${serviceKey}`).digest() : Buffer.alloc(0);

  const sign = (text: string): string => b64url(createHmac('sha256', secret).update(text).digest());

  function packCookie(data: { state: string; verifier: string; next: string; exp: number }): string {
    const body = b64url(JSON.stringify(data));
    return `${body}.${sign(body)}`;
  }

  function readCookie(value: string | undefined): { state: string; verifier: string; next: string } | null {
    if (!value) return null;
    const [body, signature, ...rest] = value.split('.');
    if (!body || !signature || rest.length > 0) return null;
    const expected = Buffer.from(sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>;
      if (typeof data.state !== 'string' || typeof data.verifier !== 'string' || typeof data.exp !== 'number') return null;
      if (data.exp < now()) return null;
      return { state: data.state, verifier: data.verifier, next: safeNext(data.next) };
    } catch {
      return null;
    }
  }

  /** The made-up address of a Lichess account: stable, unguessable, never used for email. */
  function emailFor(lichessId: string): string {
    const tag = createHmac('sha256', secret).update(`email:${lichessId}`).digest('hex').slice(0, 24);
    return `lichess-${tag}@${options.emailDomain}`;
  }

  async function supabase(path: string, body: unknown, key: string, bearer: boolean): Promise<Response> {
    return fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        // The new "secret" keys are not JWTs and go in the apikey header only; the old service_role key is a JWT.
        ...(bearer ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  }

  /** Finds or makes the Supabase account of this Lichess user and signs it in. */
  async function sessionFor(lichessId: string, username: string): Promise<{ session: Record<string, unknown>; user: { id: string; email: string } } | null> {
    const key = serviceKey!;
    const isJwt = key.startsWith('eyJ');
    const email = emailFor(lichessId);

    // 1. Make the account. "Already exists" is the normal case for a returning visitor.
    const created = await supabase(
      '/auth/v1/admin/users',
      { email, email_confirm: true, user_metadata: { name: username.slice(0, 32), lichess_id: lichessId }, app_metadata: { provider: 'lichess' } },
      key,
      isJwt,
    );
    if (!created.ok && created.status !== 422 && created.status !== 409) return null;

    // 2. A one-time sign-in link for it (nothing is sent: we only want its token) ...
    const link = await supabase('/auth/v1/admin/generate_link', { type: 'magiclink', email }, key, isJwt);
    if (!link.ok) return null;
    const hashed = ((await link.json()) as { hashed_token?: unknown }).hashed_token;
    if (typeof hashed !== 'string' || !hashed) return null;

    // 3. ... which the public key swaps for a session. Older projects call the type "magiclink", newer ones "email".
    for (const type of ['magiclink', 'email']) {
      const verified = await supabase('/auth/v1/verify', { type, token_hash: hashed }, options.supabaseKey, false);
      if (!verified.ok) continue;
      const session = (await verified.json()) as Record<string, unknown> & { user?: { id?: unknown; email?: unknown } };
      if (typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string' || typeof session.user?.id !== 'string') return null;
      return { session, user: { id: session.user.id, email: typeof session.user.email === 'string' ? session.user.email : email } };
    }
    return null;
  }

  return {
    enabled,
    /** True for an account address made by this feature (the account page does not show it). */
    isLichessEmail: (email: string): boolean => email.endsWith(`@${options.emailDomain}`),

    /** Step 1: where to send the visitor, and the cookie that remembers the flow. */
    start(next: unknown, redirectUri: string): Start {
      if (!enabled) return { ok: false, error: 'unavailable' };
      const verifier = b64url(random(32));
      const state = b64url(random(16));
      const challenge = b64url(createHash('sha256').update(verifier).digest());
      const query = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state,
      });
      return {
        ok: true,
        url: `${LICHESS_URL}/oauth?${query.toString()}`,
        cookie: packCookie({ state, verifier, next: safeNext(next), exp: now() + FLOW_SECONDS }),
        maxAge: FLOW_SECONDS,
      };
    },

    /** Step 2: Lichess has sent the visitor back. Where to send them now (to /login, with a session or an error). */
    async finish(input: { code?: unknown; state?: unknown; error?: unknown; cookie: string | undefined }, redirectUri: string): Promise<Finish> {
      const fail = (error: LichessError, next = '/'): Finish => ({
        ok: false,
        error,
        redirect: `/login?lichess_error=${error}${next !== '/' ? `&next=${encodeURIComponent(next)}` : ''}`,
      });
      if (!enabled) return fail('unavailable');

      const flow = readCookie(input.cookie);
      if (!flow) return fail('expired');
      if (typeof input.error === 'string' && input.error) return fail('cancelled', flow.next);
      if (typeof input.code !== 'string' || !input.code || input.state !== flow.state) return fail('expired', flow.next);

      try {
        const tokenResponse = await fetchImpl(`${LICHESS_URL}/api/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: input.code,
            code_verifier: flow.verifier,
            redirect_uri: redirectUri,
            client_id: CLIENT_ID,
          }).toString(),
          signal: AbortSignal.timeout(8000),
        });
        if (!tokenResponse.ok) return fail('failed', flow.next);
        const token = ((await tokenResponse.json()) as { access_token?: unknown }).access_token;
        if (typeof token !== 'string' || !token) return fail('failed', flow.next);

        const accountResponse = await fetchImpl(`${LICHESS_URL}/api/account`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        // The token was only needed to read the name: give it back to Lichess, whatever happens next.
        void fetchImpl(`${LICHESS_URL}/api/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }).catch(() => {});
        if (!accountResponse.ok) return fail('failed', flow.next);
        const account = (await accountResponse.json()) as { id?: unknown; username?: unknown; disabled?: unknown; closed?: unknown };
        if (typeof account.id !== 'string' || !/^[a-z0-9_-]{2,30}$/i.test(account.id)) return fail('failed', flow.next);
        if (account.disabled === true || account.closed === true) return fail('failed', flow.next);
        const username = typeof account.username === 'string' && account.username ? account.username : account.id;

        const signedIn = await sessionFor(account.id.toLowerCase(), username);
        if (!signedIn) return fail('failed', flow.next);
        const next = flow.next === '/' ? '' : `?next=${encodeURIComponent(flow.next)}`;
        return { ok: true, redirect: `/login${next}${sessionFragment(signedIn.session, signedIn.user)}` };
      } catch {
        return fail('failed', flow.next);
      }
    },
  };
}

export type LichessLogin = ReturnType<typeof createLichessLogin>;

/** The value of one cookie in a Cookie header. */
export function readCookieHeader(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}
