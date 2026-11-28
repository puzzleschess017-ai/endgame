// A small client for Supabase sign-in, written with fetch (no extra package). It only talks to Supabase:
// sign up, sign in, refresh, sign out and reading the visitor's profile (name and plan).
// Nothing here uses the browser, so it is covered by unit tests with a fake `fetch`.
import type { Tier } from '../utils/access';

export interface AuthConfig {
  url: string;
  /** The public ("publishable"/anon) key. It is meant to be in the page; the data is protected by row level security. */
  key: string;
  fetch?: typeof fetch;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Seconds since 1970. */
  expiresAt: number;
  userId: string;
  email: string;
}

/** Plans of a signed-in visitor. Guests have no profile. */
export type Plan = Exclude<Tier, 'guest'>;

export interface Profile {
  name: string;
  plan: Plan;
}

export type AuthResult<T> = { ok: true; value: T } | { ok: false; error: string; network?: boolean; rejected?: boolean };

export interface SignUpOutcome {
  /** null when the email has to be confirmed first. */
  session: AuthSession | null;
}

const MIN_PASSWORD = 6;

function fail(error: string, extra: { network?: boolean; rejected?: boolean } = {}): { ok: false; error: string; network?: boolean; rejected?: boolean } {
  return { ok: false, error, ...extra };
}

/** Turns an error body of Supabase into a sentence for the visitor. */
export function describeAuthError(status: number, body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = String(b.error_code ?? b.code ?? '');
  const message = String(b.msg ?? b.message ?? b.error_description ?? b.error ?? '');
  switch (code) {
    case 'invalid_credentials':
      return 'Wrong email or password.';
    case 'email_not_confirmed':
      return 'Please confirm your email first: open the message we sent you and click the link.';
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in.';
    case 'weak_password':
      return `The password is too weak. Use at least ${MIN_PASSWORD} characters.`;
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a while and try again.';
    case 'signup_disabled':
      return 'New accounts cannot be created right now.';
    case 'validation_failed':
      return 'Please check the email and password you typed.';
    default:
  }
  if (status === 429) return 'Too many attempts. Please wait a while and try again.';
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Try signing in.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first: open the message we sent you and click the link.';
  if (/password/i.test(message) && /(least|short|weak)/i.test(message)) return `The password is too weak. Use at least ${MIN_PASSWORD} characters.`;
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a while and try again.';
  return 'Something went wrong. Please try again.';
}

export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
  if (password.length < MIN_PASSWORD) return `The password needs at least ${MIN_PASSWORD} characters.`;
  return null;
}

function toSession(body: unknown, nowSeconds: number): AuthSession | null {
  const b = body as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    expires_at?: unknown;
    user?: { id?: unknown; email?: unknown };
  } | null;
  if (!b || typeof b.access_token !== 'string' || typeof b.refresh_token !== 'string') return null;
  const userId = b.user?.id;
  if (typeof userId !== 'string') return null;
  const expiresAt =
    typeof b.expires_at === 'number' ? b.expires_at : nowSeconds + (typeof b.expires_in === 'number' ? b.expires_in : 3600);
  return {
    accessToken: b.access_token,
    refreshToken: b.refresh_token,
    expiresAt,
    userId,
    email: typeof b.user?.email === 'string' ? b.user.email : '',
  };
}

export function createAuthClient(config: AuthConfig, now: () => number = () => Math.floor(Date.now() / 1000)) {
  const doFetch = config.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const base = config.url.replace(/\/+$/, '');

  async function call(
    path: string,
    init: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {},
  ): Promise<{ ok: boolean; status: number; body: unknown } | null> {
    try {
      const response = await doFetch(base + path, {
        method: init.method ?? 'GET',
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${init.token ?? config.key}`,
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { ok: response.ok, status: response.status, body };
    } catch {
      return null;
    }
  }

  const unreachable = fail('Could not reach the server. Check your connection and try again.', { network: true });

  return {
    async signUp(input: { email: string; password: string; name: string }): Promise<AuthResult<SignUpOutcome>> {
      const invalid = validateCredentials(input.email, input.password);
      if (invalid) return fail(invalid);
      const response = await call('/auth/v1/signup', {
        method: 'POST',
        body: { email: input.email.trim(), password: input.password, data: { name: input.name.trim() } },
      });
      if (!response) return unreachable;
      if (!response.ok) return fail(describeAuthError(response.status, response.body), { rejected: true });
      const session = toSession(response.body, now());
      if (session) return { ok: true, value: { session } };
      // With email confirmation on, Supabase answers 200 with the user only. For an address that is already
      // registered it answers the same way but the user has no identities.
      const user = response.body as { identities?: unknown[] } | null;
      if (user && Array.isArray(user.identities) && user.identities.length === 0) {
        return fail('An account with this email already exists. Try signing in.', { rejected: true });
      }
      return { ok: true, value: { session: null } };
    },

    async signIn(input: { email: string; password: string }): Promise<AuthResult<AuthSession>> {
      const invalid = validateCredentials(input.email, input.password);
      if (invalid) return fail(invalid);
      const response = await call('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: { email: input.email.trim(), password: input.password },
      });
      if (!response) return unreachable;
      if (!response.ok) return fail(describeAuthError(response.status, response.body), { rejected: true });
      const session = toSession(response.body, now());
      return session ? { ok: true, value: session } : fail('Something went wrong. Please try again.');
    },

    /** Trades a one-time token (made by the server after a Lichess sign-in) for a session. */
    async signInWithTokenHash(tokenHash: string): Promise<AuthResult<AuthSession>> {
      if (!/^[A-Za-z0-9_-]{8,256}$/.test(tokenHash)) return fail('The sign-in link is not valid. Please try again.', { rejected: true });
      const response = await call('/auth/v1/verify', { method: 'POST', body: { type: 'magiclink', token_hash: tokenHash } });
      if (!response) return unreachable;
      if (!response.ok) return fail('The sign-in link has expired. Please try again.', { rejected: true });
      const session = toSession(response.body, now());
      return session ? { ok: true, value: session } : fail('Something went wrong. Please try again.');
    },

    /** `rejected` means the refresh token is no good any more (sign the visitor out); `network` means try again later. */
    async refresh(refreshToken: string): Promise<AuthResult<AuthSession>> {
      const response = await call('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: refreshToken },
      });
      if (!response) return unreachable;
      if (!response.ok) {
        return response.status >= 500 || response.status === 429
          ? fail('The server is busy.', { network: true })
          : fail('Your session has ended. Please sign in again.', { rejected: true });
      }
      const session = toSession(response.body, now());
      return session ? { ok: true, value: session } : fail('Your session has ended. Please sign in again.', { rejected: true });
    },

    /** Best effort: the visitor is signed out in the browser whatever this answers. */
    async signOut(accessToken: string): Promise<void> {
      await call('/auth/v1/logout', { method: 'POST', token: accessToken });
    },

    async fetchProfile(session: AuthSession): Promise<AuthResult<Profile>> {
      const response = await call(`/rest/v1/profiles?select=name,tier&id=eq.${encodeURIComponent(session.userId)}`, {
        token: session.accessToken,
      });
      if (!response) return unreachable;
      if (response.status === 401) return fail('Your session has ended. Please sign in again.', { rejected: true });
      if (!response.ok) return fail('Could not read your profile.');
      const rows = response.body;
      const row = Array.isArray(rows) ? (rows[0] as { name?: unknown; tier?: unknown } | undefined) : undefined;
      // A signed-in visitor with no profile row yet (the table is created by hand) is on the free plan.
      return {
        ok: true,
        value: {
          name: typeof row?.name === 'string' ? row.name : '',
          plan: row?.tier === 'premium' ? 'premium' : 'free',
        },
      };
    },

    async updateName(session: AuthSession, name: string): Promise<AuthResult<true>> {
      const response = await call(`/rest/v1/profiles?id=eq.${encodeURIComponent(session.userId)}`, {
        method: 'PATCH',
        body: { name: name.trim() },
        token: session.accessToken,
        headers: { Prefer: 'return=minimal' },
      });
      if (!response) return unreachable;
      return response.ok ? { ok: true, value: true } : fail('Could not save your name.');
    },
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
