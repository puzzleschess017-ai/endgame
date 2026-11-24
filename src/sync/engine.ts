// Keeps the results of the signed-in visitor on the account, so they follow the visitor to every device.
//
// The pages keep writing their results to localStorage as always. This engine watches those keys:
//  - when someone signs in, the account's results are read and put together with the ones in this browser
//    (results made as a guest are added to the account the first time);
//  - when a result changes, the account is updated a few seconds later;
//  - when someone signs out, whatever is saved on the account is removed from this browser, so the next
//    visitor is a guest. Results that could not be saved are kept and count as the guest's own.
// All merging is in data.ts; nothing here is specific to the browser, so it is tested with fakes.
import type { AuthSession } from '../auth/client';
import type { SyncClient } from './client';
import { SYNCED, fingerprint, isEmptyData, mergeData, parse, serialize, type DataKind, type MergeMode } from './data.ts';

export const SYNC_STATE_KEY = 'ctg_sync_v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SyncStatus = 'off' | 'syncing' | 'saved' | 'error';

export interface SyncState {
  status: SyncStatus;
  /** Why the last attempt failed, for the account page. */
  error: string;
  /** Changes every time the results of this browser were changed by a sync, so pages can read them again. */
  version: number;
}

interface Saved {
  /** The account whose results are in this browser (they are not a guest's). */
  owner: string;
  /** Fingerprint of every key as it was when last put on the account. */
  synced: Record<string, string>;
}

export interface SyncEngineParts {
  client: SyncClient;
  storage: StorageLike;
  getSession: () => AuthSession | null;
}

export function createSyncEngine(parts: SyncEngineParts) {
  const { client, storage, getSession } = parts;
  let state: SyncState = { status: 'off', error: '', version: 0 };
  const listeners = new Set<() => void>();
  let running: Promise<void> | null = null;
  let again = false;

  const emit = () => listeners.forEach((l) => l());
  const setState = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch };
    emit();
  };

  function readSaved(): Saved | null {
    try {
      const raw = storage.getItem(SYNC_STATE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
      if (!parsed || typeof parsed.owner !== 'string' || !parsed.synced || typeof parsed.synced !== 'object') return null;
      return { owner: parsed.owner, synced: parsed.synced as Record<string, string> };
    } catch {
      return null;
    }
  }

  function writeSaved(saved: Saved | null): void {
    try {
      if (saved) storage.setItem(SYNC_STATE_KEY, JSON.stringify(saved));
      else storage.removeItem(SYNC_STATE_KEY);
    } catch {
      // storage blocked: nothing can be remembered, results simply stay where they are
    }
  }

  /** Results in this browser that were never put on an account (or changed since). */
  function localChanges(saved: Saved | null): string[] {
    return SYNCED.filter(({ key }) => fingerprint(storage.getItem(key)) !== (saved?.synced[key] ?? '')).map(({ key }) => key);
  }

  /** Nothing saved here that is not on the account yet. */
  function isClean(): boolean {
    const saved = readSaved();
    return !!saved && localChanges(saved).length === 0;
  }

  /**
   * Nobody is signed in: results that belong to an account (and are on it) are removed from this browser.
   * Results that were never saved stay and count as the guest's own.
   */
  function becomeGuest(): void {
    const saved = readSaved();
    if (saved) {
      for (const { key } of SYNCED) {
        if (fingerprint(storage.getItem(key)) === (saved.synced[key] ?? '')) storage.removeItem(key);
      }
      writeSaved(null);
      setState({ status: 'off', error: '', version: state.version + 1 });
    } else if (state.status !== 'off') {
      setState({ status: 'off', error: '' });
    }
  }

  async function runOnce(session: AuthSession): Promise<void> {
    let saved = readSaved();
    if (saved && saved.owner !== session.userId) {
      // Left over from another account (it was never signed out cleanly): clear what is on that account.
      becomeGuest();
      saved = null;
    }
    // "reconcile" when this browser already holds this account's results, "combine" for a guest's results.
    const mode: MergeMode = saved ? 'reconcile' : 'combine';

    const remote = await client.fetchAll(session);
    if (!remote.ok) {
      if (!remote.rejected) setState({ status: 'error', error: remote.error });
      return;
    }
    if (getSession()?.userId !== session.userId) return; // signed out or switched while waiting

    // The merge itself does not wait, so no result written meanwhile is lost.
    const plan: Array<{ key: string; kind: DataKind; value: unknown; raw: string; localRaw: string | null; empty: boolean }> = [];
    const toSave: Record<string, unknown> = {};
    for (const { key, kind } of SYNCED) {
      const localRaw = storage.getItem(key);
      const theirs = remote.value[key];
      const value = mergeData(kind, parse(localRaw), theirs, mode);
      const raw = serialize(value);
      const empty = isEmptyData(kind, value);
      plan.push({ key, kind, value, raw, localRaw, empty });
      // Saved when the account does not have exactly this yet.
      if (!empty && serialize(mergeData(kind, theirs, theirs, 'reconcile')) !== raw) toSave[key] = value;
    }

    // The account is written first: if that fails nothing here changes, so trying again is safe.
    if (Object.keys(toSave).length > 0) {
      const saveResult = await client.save(session, toSave);
      if (!saveResult.ok) {
        if (!saveResult.rejected) setState({ status: 'error', error: saveResult.error });
        return;
      }
      if (getSession()?.userId !== session.userId) return;
    }

    // Now the browser gets the same results. A result written while waiting is kept (and saved next time).
    const synced: Record<string, string> = {};
    let changedHere = false;
    for (const { key, kind, value, raw, localRaw, empty } of plan) {
      if (empty) {
        synced[key] = fingerprint(localRaw);
        continue;
      }
      const now = storage.getItem(key);
      const current = serialize(parse(now));
      if (now === localRaw) {
        if (current !== raw) {
          storage.setItem(key, raw);
          changedHere = true;
        }
      } else {
        const together = serialize(mergeData(kind, parse(now), value, 'reconcile'));
        if (together !== current) {
          storage.setItem(key, together);
          changedHere = true;
        }
      }
      // What the account has: the local text when it means the same, else the text written above.
      synced[key] = now === localRaw && current === raw ? fingerprint(now) : fingerprint(raw);
    }
    writeSaved({ owner: session.userId, synced });
    setState({ status: 'saved', error: '', version: changedHere ? state.version + 1 : state.version });
  }

  /** Reads the account, puts the results together, and saves what the account does not have yet. */
  function syncNow(): Promise<void> {
    const session = getSession();
    if (!session) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    if (state.status !== 'saved') setState({ status: 'syncing' });
    running = (async () => {
      try {
        do {
          again = false;
          const current = getSession();
          if (!current) break;
          await runOnce(current);
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    getState: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    syncNow,
    /** True when this browser holds results that are not on the signed-in account yet. */
    hasUnsaved(): boolean {
      const session = getSession();
      const saved = readSaved();
      if (!session) return false;
      return !saved || saved.owner !== session.userId || localChanges(saved).length > 0;
    },
    becomeGuest,
    isClean,
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
