// Keeps the results of the signed-in visitor on the account, so they follow the visitor to every device.
//
// The pages keep writing their results to localStorage as always. This engine watches those keys:
//  - when someone signs in, the account's results are read and put together with the ones in this browser
//    (results made as a guest are added to the account the first time);
//  - when a result changes, the account is updated a few seconds later;
//  - when someone signs out, whatever is saved on the account is removed from this browser, so the next
//    visitor is a guest. Results that could not be saved yet stay, and they still belong to that account: if the
//    same account signs in again they are put back on it, and if ANOTHER account signs in they are put aside
//    (never added to the other account, which would count every puzzle of the first one again).
// All merging is in data.ts; nothing here is specific to the browser, so it is tested with fakes.
import type { AuthSession } from '../auth/client';
import type { SyncClient } from './client';
import { SYNCED, fingerprint, isEmptyData, mergeData, parse, serialize, type DataKind, type MergeMode } from './data.ts';

export const SYNC_STATE_KEY = 'ctg_sync_v1';
/** Unsaved results of an account that signed out while another account signed in: { accountId: { key: text } }. */
export const SYNC_ASIDE_KEY = 'ctg_sync_aside_v1';
const ASIDE_ACCOUNTS_KEPT = 5;

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
  /**
   * Runs `fn` while no other tab of this browser is syncing (they share the same storage). Without it two tabs can sync
   * at the same moment, and the second one would put the results the first one just wrote together with the account's
   * once more. The page passes the browser's Web Locks; tests may pass none.
   */
  lock?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export function createSyncEngine(parts: SyncEngineParts) {
  const { client, storage, getSession, lock } = parts;
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

  function readAside(): Record<string, Record<string, string>> {
    try {
      const parsed = JSON.parse(storage.getItem(SYNC_ASIDE_KEY) ?? 'null');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const out: Record<string, Record<string, string>> = {};
      for (const [owner, values] of Object.entries(parsed as Record<string, unknown>)) {
        if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
        const clean: Record<string, string> = {};
        for (const [key, raw] of Object.entries(values as Record<string, unknown>)) if (typeof raw === 'string') clean[key] = raw;
        if (Object.keys(clean).length > 0) out[owner] = clean;
      }
      return out;
    } catch {
      return {};
    }
  }

  function writeAside(aside: Record<string, Record<string, string>>): void {
    try {
      const owners = Object.keys(aside);
      for (const old of owners.slice(0, Math.max(0, owners.length - ASIDE_ACCOUNTS_KEPT))) delete aside[old];
      if (Object.keys(aside).length === 0) storage.removeItem(SYNC_ASIDE_KEY);
      else storage.setItem(SYNC_ASIDE_KEY, JSON.stringify(aside));
    } catch {
      // storage full or blocked: the results that were put aside may be lost, nothing else is affected
    }
  }

  /**
   * The results in this browser belong to another account than the one signing in (it was signed out here with results
   * that were not on it yet). What is on that account is removed; what is not is put aside for it, so that its owner gets
   * it back at the next sign-in. Nothing of it goes to the account that signs in now.
   */
  function leaveOwner(saved: Saved): void {
    const aside = readAside();
    let removed = false;
    for (const { key, kind } of SYNCED) {
      const raw = storage.getItem(key);
      if (raw === null) continue;
      if (fingerprint(raw) !== (saved.synced[key] ?? '')) {
        const mine = { ...(aside[saved.owner] ?? {}) };
        mine[key] = key in mine ? serialize(mergeData(kind, parse(mine[key]), parse(raw), 'reconcile')) : raw;
        delete aside[saved.owner];
        aside[saved.owner] = mine; // most recent last
      }
      storage.removeItem(key);
      removed = true;
    }
    writeAside(aside);
    writeSaved(null);
    setState({ status: 'off', error: '', version: removed ? state.version + 1 : state.version });
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
      let removed = false;
      let kept = false;
      for (const { key } of SYNCED) {
        const raw = storage.getItem(key);
        if (raw === null) continue;
        if (fingerprint(raw) === (saved.synced[key] ?? '')) {
          storage.removeItem(key);
          removed = true;
        } else {
          kept = true;
        }
      }
      // Results that were not on the account yet stay here, and they hold the account's earlier results as
      // well. So whose they are is remembered: when the same account signs in again they are put together
      // with the account's (the larger number of each day wins). Forgetting it would make the next sign-in
      // treat them as a guest's and ADD them to what the account has, counting every puzzle again.
      writeSaved(kept ? { owner: saved.owner, synced: {} } : null);
      setState({ status: 'off', error: '', version: removed ? state.version + 1 : state.version });
    } else if (state.status !== 'off') {
      setState({ status: 'off', error: '' });
    }
  }

  async function runOnce(session: AuthSession): Promise<void> {
    const before = readSaved();
    if (before && before.owner !== session.userId) {
      // Left over from another account (it signed out before everything was saved): its results are put aside.
      leaveOwner(before);
    }

    const remote = await client.fetchAll(session);
    if (!remote.ok) {
      if (!remote.rejected) setState({ status: 'error', error: remote.error });
      return;
    }
    if (getSession()?.userId !== session.userId) return; // signed out or switched while waiting

    // Whose results are in this browser is read NOW, together with the results themselves, and not before the account
    // was read: another tab may have synced while this one waited, and deciding from the earlier look would count the
    // same results twice ("combine" them with the account's again).
    let saved = readSaved();
    if (saved && saved.owner !== session.userId) {
      leaveOwner(saved);
      saved = null;
    }
    // "reconcile" when this browser already holds this account's results, "combine" for a guest's results.
    const mode: MergeMode = saved ? 'reconcile' : 'combine';

    // The merge itself does not wait, so no result written meanwhile is lost.
    const plan: Array<{ key: string; kind: DataKind; value: unknown; raw: string; localRaw: string | null; empty: boolean }> = [];
    const toSave: Record<string, unknown> = {};
    // Results of this account that were put aside while another account was signed in come back now.
    const aside = readAside()[session.userId];
    for (const { key, kind } of SYNCED) {
      const localRaw = storage.getItem(key);
      const onAccount = remote.value[key];
      const theirs = aside && key in aside ? mergeData(kind, onAccount, parse(aside[key]), 'reconcile') : onAccount;
      const value = mergeData(kind, parse(localRaw), theirs, mode);
      const raw = serialize(value);
      const empty = isEmptyData(kind, value);
      plan.push({ key, kind, value, raw, localRaw, empty });
      // Saved when the account does not have exactly this yet.
      if (!empty && serialize(mergeData(kind, onAccount, onAccount, 'reconcile')) !== raw) toSave[key] = value;
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

    // The results that were put aside are on the account now.
    if (aside) {
      const left = readAside();
      delete left[session.userId];
      writeAside(left);
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
          // One tab at a time: the session is read again once it is this tab's turn.
          await (lock
            ? lock(async () => {
                const turn = getSession();
                if (turn) await runOnce(turn);
              })
            : runOnce(current));
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
