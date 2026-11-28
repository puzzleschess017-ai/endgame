// The results sync of the page, wired to the sign-in and the browser. Importing this file starts it
// (src/main.tsx does), so every page keeps its results on the account while someone is signed in.
import { useSyncExternalStore } from 'react';
import { auth, supabaseConfig } from '../auth';
import { applyRunOwner } from '../utils/runOwner';
import { createSyncClient } from './client';
import { createSyncEngine, type StorageLike, type SyncState } from './engine';

const noStorage: StorageLike = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function browserStorage(): StorageLike {
  try {
    return window.localStorage;
  } catch {
    return noStorage;
  }
}

export const sync = createSyncEngine({
  client: createSyncClient(supabaseConfig),
  storage: typeof window === 'undefined' ? noStorage : browserStorage(),
  getSession: () => auth.getState().session,
  // Tabs of the same browser share the results, so only one of them syncs at a time.
  lock: (fn) => (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('ctg-results-sync', fn) : fn()),
});

const CHECK_MS = 5_000;
const RETRY_AFTER_ERROR_MS = 60_000;
const REFRESH_MS = 5 * 60_000;

if (typeof window !== 'undefined') {
  let user = '';
  let failedAt = 0;
  let refreshedAt = 0;

  const attach = () => {
    const { session } = auth.getState();
    // Unfinished runs stay with the account that started them.
    applyRunOwner(browserStorage(), session?.userId ?? null);
    if (!session) {
      user = '';
      sync.becomeGuest();
    } else if (session.userId !== user) {
      user = session.userId;
      void sync.syncNow();
    }
  };
  auth.subscribe(attach);
  // The sign-in was read before this file ran, so it is looked at once now.
  attach();

  sync.subscribe(() => {
    if (sync.getState().status === 'error') failedAt = Date.now();
    if (sync.getState().status === 'saved') refreshedAt = Date.now();
  });

  const check = (force = false) => {
    if (!auth.getState().session) return;
    const now = Date.now();
    if (sync.getState().status === 'error' && now - failedAt < RETRY_AFTER_ERROR_MS && !force) return;
    // Results that are not on the account yet are saved soon; the account is read again now and then,
    // so results from another device show up.
    if (sync.hasUnsaved() || now - refreshedAt > REFRESH_MS) void sync.syncNow();
  };
  window.setInterval(() => check(), CHECK_MS);
  document.addEventListener('visibilitychange', () => check(true));
  window.addEventListener('online', () => check(true));
}

/** Signs out after the results are on the account (waits a few seconds at most). */
export async function signOutAndSync(): Promise<void> {
  if (auth.getState().session && sync.hasUnsaved()) {
    await Promise.race([sync.syncNow(), new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
  }
  await auth.signOut();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(sync.subscribe, sync.getState, sync.getState);
}

/** Changes whenever a sync changed the results of this browser: a page that read them earlier reads them again. */
export function useSyncVersion(): number {
  return useSyncState().version;
}
