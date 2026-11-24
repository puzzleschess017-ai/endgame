// Who is asking? The browser sends the Supabase sign-in token in the Authorization header; this asks
// Supabase whether the token is real and which plan the account has ("free" or "premium"). Nobody
// signed in is a guest. Answers are remembered for a minute, so a round of puzzles costs one lookup.
import type { Tier } from '../src/utils/access.ts';

export interface TierLookupOptions {
  url: string;
  key: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** How long an answer is remembered, in milliseconds. */
  ttlMs?: number;
}

export type Visitor = { ok: true; tier: Tier } | { ok: false; status: 401; error: string };

const EXPIRED = 'Your sign-in has expired. Please sign in again.';
const USER_ID = /^[0-9a-f-]{32,40}$/i;
const MAX_REMEMBERED = 1000;

export function createTierLookup(options: TierLookupOptions): (authorization: string | undefined) => Promise<Visitor> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const ttl = options.ttlMs ?? 60_000;
  const base = options.url.replace(/\/+$/, '');
  const remembered = new Map<string, { tier: Tier; until: number }>();

  async function ask(path: string, token: string): Promise<Response> {
    return fetchImpl(`${base}${path}`, {
      headers: { apikey: options.key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
  }

  return async function lookup(authorization) {
    const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1];
    if (!token) return { ok: true, tier: 'guest' };

    const hit = remembered.get(token);
    if (hit && hit.until > now()) return { ok: true, tier: hit.tier };

    // If Supabase cannot be reached the plan is unknown: the visitor is treated as signed in on the free plan.
    const unknown: Visitor = { ok: true, tier: 'free' };
    try {
      const who = await ask('/auth/v1/user', token);
      if (who.status === 401 || who.status === 403) return { ok: false, status: 401, error: EXPIRED };
      if (!who.ok) return unknown;
      const id = ((await who.json()) as { id?: unknown }).id;
      if (typeof id !== 'string' || !USER_ID.test(id)) return unknown;

      const profile = await ask(`/rest/v1/profiles?select=tier&id=eq.${id}`, token);
      if (!profile.ok) return unknown;
      const rows = (await profile.json()) as Array<{ tier?: unknown }>;
      const raw = Array.isArray(rows) ? rows[0]?.tier : undefined;
      const tier: Tier = raw === 'premium' ? 'premium' : 'free';

      if (remembered.size >= MAX_REMEMBERED) remembered.clear();
      remembered.set(token, { tier, until: now() + ttl });
      return { ok: true, tier };
    } catch {
      return unknown;
    }
  };
}
