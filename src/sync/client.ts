// Reads and writes the results of the signed-in visitor in the Supabase table `user_data`
// (one row per key; see supabase/schema.sql). Plain fetch, tested with a fake one.
import type { AuthSession } from '../auth/client';

export interface SyncClientConfig {
  url: string;
  key: string;
  fetch?: typeof fetch;
}

export type SyncResult<T> = { ok: true; value: T } | { ok: false; error: string; rejected?: boolean };

export type RemoteData = Record<string, unknown>;

export function createSyncClient(config: SyncClientConfig) {
  const doFetch = config.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const base = config.url.replace(/\/+$/, '');

  async function call(session: AuthSession, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; keepalive?: boolean } = {}) {
    try {
      const response = await doFetch(base + path, {
        method: init.method ?? 'GET',
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${session.accessToken}`,
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        keepalive: init.keepalive,
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

  function failure(response: { status: number; body: unknown } | null, what: string): { ok: false; error: string; rejected?: boolean } {
    if (!response) return { ok: false, error: `Could not reach the server to ${what}.` };
    if (response.status === 401) return { ok: false, error: 'Your session has ended.', rejected: true };
    if (response.status === 404) return { ok: false, error: 'Saving results on the account is not set up yet (the user_data table is missing).' };
    return { ok: false, error: `Could not ${what} (${response.status}).` };
  }

  return {
    /** Every saved key of the account, as parsed JSON. */
    async fetchAll(session: AuthSession): Promise<SyncResult<RemoteData>> {
      const response = await call(session, `/rest/v1/user_data?select=key,value&user_id=eq.${encodeURIComponent(session.userId)}`);
      if (!response || !response.ok) return failure(response, 'read your results');
      const out: RemoteData = {};
      if (Array.isArray(response.body)) {
        for (const row of response.body as Array<{ key?: unknown; value?: unknown }>) {
          if (typeof row?.key === 'string') out[row.key] = row.value;
        }
      }
      return { ok: true, value: out };
    },

    /** Saves the given keys (a key that exists is replaced). */
    async save(session: AuthSession, values: RemoteData, options: { keepalive?: boolean } = {}): Promise<SyncResult<true>> {
      const rows = Object.entries(values).map(([key, value]) => ({ user_id: session.userId, key, value, updated_at: new Date().toISOString() }));
      if (rows.length === 0) return { ok: true, value: true };
      const response = await call(session, '/rest/v1/user_data?on_conflict=user_id,key', {
        method: 'POST',
        body: rows,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        keepalive: options.keepalive,
      });
      if (!response || !response.ok) return failure(response, 'save your results');
      return { ok: true, value: true };
    },
  };
}

export type SyncClient = ReturnType<typeof createSyncClient>;
