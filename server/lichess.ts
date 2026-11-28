// "Continue with Lichess": signing in with a Lichess account.
//
// Supabase has no Lichess provider, so the server does the OAuth part itself and then asks Supabase to let that person in:
//   1. /auth/lichess         sends the browser to Lichess (OAuth 2 with PKCE; a public client, so there is no secret)
//   2. /auth/lichess/callback gets the code back, trades it for a token, reads the account and its email, throws the
//                             token away, makes sure a Supabase user with that email exists, and asks Supabase for a
//                             one-time sign-in token (a "magic link" token, never emailed)
//   3. the browser is sent to /login#lichess=<token>, where the page trades the token for a normal session
// Who is who: the Lichess account id is remembered in the table lichess_links (supabase/schema.sql), so the same Lichess
// account always opens the same site account, whatever email it has. A signed-in person can link their Lichess account to
// the account they already have (their email can differ from the one at Lichess); without a link, the email decides.
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

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  /** Set when a signed-in person links their Lichess account: the id of their account (checked when the flow started). */
  link?: string;
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
    const link = typeof parsed.link === 'string' && USER_ID.test(parsed.link) ? parsed.link.toLowerCase() : undefined;
    return { verifier: parsed.verifier, state: parsed.state, next: safeNext(parsed.next), ...(link ? { link } : {}) };
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

export const LICHESS_UNAVAILABLE = 'Lichess sign-in is not available right now.';

export type LichessFailure = 'denied' | 'no_email' | 'unavailable' | 'other_link';

export type LichessResult = { ok: true; tokenHash: string } | { ok: true; linked: true } | { ok: false; reason: LichessFailure };

const LICHESS = 'https://lichess.org';
const TIMEOUT_MS = 8000;

interface LichessAccount {
  /** The Lichess id (the lower case form of the name; it does not change when only the capitals of the name change). */
  id: string;
  username: string;
  /** null when the account has none we can use. */
  email: string | null;
}

async function readAccount(code: string, verifier: string, settings: LichessSettings, fetchImpl: typeof fetch): Promise<LichessAccount | 'denied' | null> {
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
    const account = (await accountRes.json().catch(() => null)) as { username?: unknown; id?: unknown } | null;
    const username = account?.username;
    const id = account?.id;
    const email = ((await emailRes.json().catch(() => null)) as { email?: unknown } | null)?.email;
    if (typeof username !== 'string' || !/^[A-Za-z0-9_-]{1,30}$/.test(username)) return null;
    if (typeof id !== 'string' || !/^[a-z0-9_-]{1,30}$/.test(id)) return null;
    const usable = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    return { id, username, email: usable ? (email as string).trim().toLowerCase() : null };
  } finally {
    // The site only needed to know who this is: the token is not kept.
    void fetchImpl(`${LICHESS}/api/token`, { method: 'DELETE', headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => undefined);
  }
}

function adminHeaders(settings: LichessSettings): Record<string, string> {
  // A legacy service role key is a JWT and is also sent as the bearer token; a new "sb_secret_..." key only goes in apikey.
  const headers: Record<string, string> = { apikey: settings.serviceKey, 'Content-Type': 'application/json' };
  if (settings.serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${settings.serviceKey}`;
  return headers;
}

const baseOf = (settings: LichessSettings) => settings.supabaseUrl.replace(/\/+$/, '');

/** The site account that is linked to a Lichess account: its id, null when there is none, undefined when it could not be read. */
async function linkedUser(lichessId: string, settings: LichessSettings, fetchImpl: typeof fetch): Promise<string | null | undefined> {
  const res = await fetchImpl(`${baseOf(settings)}/rest/v1/lichess_links?select=user_id&lichess_id=eq.${encodeURIComponent(lichessId)}`, {
    headers: adminHeaders(settings),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // The table is made by supabase/schema.sql. Until it is there, the email decides (as it did before the links).
  if (!res.ok) return res.status === 404 || res.status === 400 ? null : undefined;
  const rows = (await res.json().catch(() => null)) as { user_id?: unknown }[] | null;
  const id = Array.isArray(rows) ? rows[0]?.user_id : undefined;
  return typeof id === 'string' && USER_ID.test(id) ? id.toLowerCase() : null;
}

/** Remembers that this Lichess account belongs to this site account (replacing an older link of the same Lichess account). */
async function saveLink(lichessId: string, userId: string, username: string, settings: LichessSettings, fetchImpl: typeof fetch): Promise<'ok' | 'other_link' | 'failed'> {
  const res = await fetchImpl(`${baseOf(settings)}/rest/v1/lichess_links?on_conflict=lichess_id`, {
    method: 'POST',
    headers: { ...adminHeaders(settings), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ lichess_id: lichessId, user_id: userId, username }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.ok) return 'ok';
  // 409 is the unique key on user_id: this site account is linked to another Lichess account already.
  return res.status === 409 ? 'other_link' : 'failed';
}

async function emailOfUser(userId: string, settings: LichessSettings, fetchImpl: typeof fetch): Promise<string | null> {
  const res = await fetchImpl(`${baseOf(settings)}/auth/v1/admin/users/${userId}`, { headers: adminHeaders(settings), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const email = ((await res.json().catch(() => null)) as { email?: unknown } | null)?.email;
  return typeof email === 'string' && email ? email : null;
}

/** A person whose profile has no name yet gets their Lichess name (only an empty name is filled: the filter makes it a no-op otherwise). */
async function fillEmptyName(userId: string, username: string, settings: LichessSettings, fetchImpl: typeof fetch): Promise<void> {
  await fetchImpl(`${baseOf(settings)}/rest/v1/profiles?id=eq.${userId}&name=eq.`, {
    method: 'PATCH',
    headers: { ...adminHeaders(settings), Prefer: 'return=minimal' },
    body: JSON.stringify({ name: username }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Asks Supabase for a one-time token that signs the user with this email in. Gives back the user id too. */
async function oneTimeToken(email: string, settings: LichessSettings, fetchImpl: typeof fetch): Promise<{ tokenHash: string; userId: string | null } | null> {
  const link = await fetchImpl(`${baseOf(settings)}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: adminHeaders(settings),
    body: JSON.stringify({ type: 'magiclink', email }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!link.ok) return null;
  const body = (await link.json().catch(() => null)) as { id?: unknown; hashed_token?: unknown; properties?: { hashed_token?: unknown } } | null;
  const tokenHash = body?.hashed_token ?? body?.properties?.hashed_token;
  if (typeof tokenHash !== 'string' || !tokenHash) return null;
  return { tokenHash, userId: typeof body?.id === 'string' && USER_ID.test(body.id) ? body.id.toLowerCase() : null };
}

/** Makes sure a user with this email exists. A new one is created confirmed (Lichess has confirmed the address); an existing one answers 4xx and is left as it is. */
async function ensureUser(account: LichessAccount & { email: string }, settings: LichessSettings, fetchImpl: typeof fetch): Promise<boolean> {
  const created = await fetchImpl(`${baseOf(settings)}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(settings),
    body: JSON.stringify({ email: account.email, email_confirm: true, user_metadata: { name: account.username, lichess: account.username } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return created.ok || created.status < 500;
}

export async function finishLichessLogin(
  input: { code: string; verifier: string; link?: string },
  settings: LichessSettings,
  fetchImpl: typeof fetch = fetch,
): Promise<LichessResult> {
  try {
    const account = await readAccount(input.code, input.verifier, settings, fetchImpl);
    if (account === 'denied') return { ok: false, reason: 'denied' };
    if (!account) return { ok: false, reason: 'unavailable' };

    // A signed-in person links this Lichess account to the account they have.
    if (input.link) {
      const saved = await saveLink(account.id, input.link, account.username, settings, fetchImpl);
      if (saved === 'ok') return { ok: true, linked: true };
      return { ok: false, reason: saved === 'other_link' ? 'other_link' : 'unavailable' };
    }

    // A Lichess account that is linked opens its site account, whatever email either has.
    const linked = await linkedUser(account.id, settings, fetchImpl);
    if (linked === undefined) return { ok: false, reason: 'unavailable' };
    let email = linked ? await emailOfUser(linked, settings, fetchImpl) : null;
    if (linked && !email) return { ok: false, reason: 'unavailable' };

    if (!email) {
      if (!account.email) return { ok: false, reason: 'no_email' };
      if (!(await ensureUser({ ...account, email: account.email }, settings, fetchImpl))) return { ok: false, reason: 'unavailable' };
      email = account.email;
    }
    const token = await oneTimeToken(email, settings, fetchImpl);
    if (!token) return { ok: false, reason: 'unavailable' };
    // First time: remember which site account this Lichess account opened (no harm if that cannot be saved just now).
    if (!linked && token.userId) await saveLink(account.id, token.userId, account.username, settings, fetchImpl).catch(() => undefined);
    const who = linked ?? token.userId;
    if (who) await fillEmptyName(who, account.username, settings, fetchImpl).catch(() => undefined);
    return { ok: true, tokenHash: token.tokenHash };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
