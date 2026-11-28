// "Continue with Lichess": signing in with a Lichess account.
//
// Supabase has no Lichess provider, so the server does the OAuth part itself and then asks Supabase to let that person in:
//   1. /auth/lichess         sends the browser to Lichess (OAuth 2 with PKCE; a public client, so there is no secret)
//   2. /auth/lichess/callback gets the code back, trades it for a token, reads the account and its email, throws the
//                             token away, makes sure a Supabase user with that email exists, and asks Supabase for a
//                             one-time sign-in token (a "magic link" token, never emailed)
//   3. the browser is sent to /login#lichess=<token>, where the page trades the token for a normal session
// Needs SUPABASE_SERVICE_ROLE_KEY (the same one the payment webhook uses). Nothing else has to be set up: Lichess does not
// ask apps to register, the client id is just the name of the site.
import crypto from 'node:crypto';

export interface LichessSettings {
  clientId: string;
  redirectUri: string;
  supabaseUrl: string;
  serviceKey: string;
  /** Secret for the cookie that carries the PKCE verifier; derived from the service key, so nothing more to configure. */
  cookieKey: Buffer;
}

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined) => (value ?? '').trim();

/** On only when the service key is there. */
export function loadLichessSettings(env: Env, siteUrl: string, supabaseUrl: string): LichessSettings | null {
  const serviceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceKey) return null;
  return {
    clientId: new URL(siteUrl).host,
    redirectUri: `${siteUrl.replace(/\/+$/, '')}/auth/lichess/callback`,
    supabaseUrl,
    serviceKey,
    cookieKey: crypto.createHash('sha256').update(`lichess-oauth:${serviceKey}`).digest(),
  };
}

// ---------------------------------------------------------------------------------------------
// PKCE and the cookie that remembers it between the two requests
// ---------------------------------------------------------------------------------------------

const b64url = (buffer: Buffer) => buffer.toString('base64url');

export interface Pkce {
  verifier: string;
  challenge: string;
  state: string;
}

export function newPkce(): Pkce {
  const verifier = b64url(crypto.randomBytes(48));
  return {
    verifier,
    challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    state: b64url(crypto.randomBytes(18)),
  };
}

export interface FlowCookie {
  verifier: string;
  state: string;
  /** Where to go after signing in (a path of this site). */
  next: string;
}

export const FLOW_COOKIE = 'ctg_lichess';
const FLOW_MAX_AGE_SECONDS = 600;

const sign = (key: Buffer, data: string) => b64url(crypto.createHmac('sha256', key).update(data).digest());

/** The cookie value: the data and its signature, so it cannot be made up or changed by anyone else. */
export function sealFlow(key: Buffer, flow: FlowCookie, nowSeconds: number = Date.now() / 1000): string {
  const data = b64url(Buffer.from(JSON.stringify({ ...flow, exp: Math.floor(nowSeconds) + FLOW_MAX_AGE_SECONDS }), 'utf8'));
  return `${data}.${sign(key, data)}`;
}

export function openFlow(key: Buffer, value: string | undefined, nowSeconds: number = Date.now() / 1000): FlowCookie | null {
  if (!value) return null;
  const [data, signature, ...rest] = value.split('.');
  if (!data || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(key, data));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Partial<FlowCookie> & { exp?: unknown };
    if (typeof parsed.exp !== 'number' || parsed.exp < nowSeconds) return null;
    if (typeof parsed.verifier !== 'string' || typeof parsed.state !== 'string' || typeof parsed.next !== 'string') return null;
    return { verifier: parsed.verifier, state: parsed.state, next: safeNext(parsed.next) };
  } catch {
    return null;
  }
}

/** A single cookie of a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

export function flowCookieHeader(value: string, secure: boolean): string {
  return `${FLOW_COOKIE}=${value}; Path=/auth/lichess; HttpOnly; SameSite=Lax; Max-Age=${FLOW_MAX_AGE_SECONDS}${secure ? '; Secure' : ''}`;
}

export function clearFlowCookieHeader(secure: boolean): string {
  return `${FLOW_COOKIE}=; Path=/auth/lichess; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

/** The page to go to afterwards: a path of this site (the same rule as ?next= on the login page), else Home. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(next) ? next : '/';
}

export function authorizeUrl(settings: LichessSettings, pkce: Pkce): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: pkce.challenge,
    scope: 'email:read',
    state: pkce.state,
  });
  return `https://lichess.org/oauth?${params.toString()}`;
}

// ---------------------------------------------------------------------------------------------
// After Lichess has answered
// ---------------------------------------------------------------------------------------------

export type LichessFailure = 'denied' | 'no_email' | 'unavailable';

export type LichessResult = { ok: true; tokenHash: string } | { ok: false; reason: LichessFailure };

const LICHESS = 'https://lichess.org';
const TIMEOUT_MS = 8000;

interface LichessAccount {
  username: string;
  email: string;
}

async function readAccount(code: string, verifier: string, settings: LichessSettings, fetchImpl: typeof fetch): Promise<LichessAccount | 'denied' | 'no_email' | null> {
  const tokenRes = await fetchImpl(`${LICHESS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: settings.redirectUri,
      client_id: settings.clientId,
    }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (tokenRes.status >= 400 && tokenRes.status < 500) return 'denied';
  if (!tokenRes.ok) return null;
  const token = ((await tokenRes.json().catch(() => null)) as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== 'string' || !token) return null;
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  try {
    const [accountRes, emailRes] = await Promise.all([
      fetchImpl(`${LICHESS}/api/account`, { headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) }),
      fetchImpl(`${LICHESS}/api/account/email`, { headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) }),
    ]);
    if (!accountRes.ok || !emailRes.ok) return null;
    const username = ((await accountRes.json().catch(() => null)) as { username?: unknown } | null)?.username;
    const email = ((await emailRes.json().catch(() => null)) as { email?: unknown } | null)?.email;
    if (typeof username !== 'string' || !/^[A-Za-z0-9_-]{1,30}$/.test(username)) return null;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'no_email';
    return { username, email: email.trim().toLowerCase() };
  } finally {
    // The site only needed to know who this is: the token is not kept.
    void fetchImpl(`${LICHESS}/api/token`, { method: 'DELETE', headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => undefined);
  }
}

/** Makes sure a user with this email exists, then asks Supabase for a one-time token that signs that user in. */
async function supabaseTokenFor(account: LichessAccount, settings: LichessSettings, fetchImpl: typeof fetch): Promise<string | null> {
  const base = settings.supabaseUrl.replace(/\/+$/, '');
  // A legacy service role key is a JWT and is also sent as the bearer token; a new "sb_secret_..." key only goes in apikey.
  const headers: Record<string, string> = { apikey: settings.serviceKey, 'Content-Type': 'application/json' };
  if (settings.serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${settings.serviceKey}`;

  // A new user is created confirmed (Lichess has confirmed the address). An existing one answers 4xx and is left as it is.
  const created = await fetchImpl(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: account.email, email_confirm: true, user_metadata: { name: account.username, lichess: account.username } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!created.ok && created.status >= 500) return null;

  const link = await fetchImpl(`${base}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'magiclink', email: account.email }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!link.ok) return null;
  const body = (await link.json().catch(() => null)) as { hashed_token?: unknown; properties?: { hashed_token?: unknown } } | null;
  const tokenHash = body?.hashed_token ?? body?.properties?.hashed_token;
  return typeof tokenHash === 'string' && tokenHash ? tokenHash : null;
}

export async function finishLichessLogin(
  input: { code: string; verifier: string },
  settings: LichessSettings,
  fetchImpl: typeof fetch = fetch,
): Promise<LichessResult> {
  try {
    const account = await readAccount(input.code, input.verifier, settings, fetchImpl);
    if (account === 'denied' || account === 'no_email') return { ok: false, reason: account };
    if (!account) return { ok: false, reason: 'unavailable' };
    const tokenHash = await supabaseTokenFor(account, settings, fetchImpl);
    return tokenHash ? { ok: true, tokenHash } : { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
