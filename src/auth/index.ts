// The one auth store of the page, wired to the real Supabase project and the browser.
import { useSyncExternalStore } from 'react';
import { INTRO_COMPLETED_STORAGE_KEY, USERNAME_STORAGE_KEY } from '../utils/profile';
import { createAuthClient } from './client';
import { DEFAULT_SUPABASE_KEY, DEFAULT_SUPABASE_URL } from './project';
import { AUTH_STORAGE_KEY, createAuthStore, type AuthState } from './store';

// Environment values override the project (used for testing against a fake server).
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || DEFAULT_SUPABASE_KEY;

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return noStorage;
  }
}

/** Where the Supabase project is: the other parts of the page that talk to it (saved results) use this. */
export const supabaseConfig = { url: SUPABASE_URL, key: SUPABASE_KEY };

export const auth = createAuthStore({
  client: createAuthClient(supabaseConfig),
  storage: typeof window === 'undefined' ? noStorage : browserStorage(),
});

if (typeof window !== 'undefined') {
  // A signed-in visitor is greeted by the account name on every page, and is not asked for a name again.
  // Signing out takes that name away again, so the next visitor of this browser is a guest, not the account.
  let wasSignedIn = false;
  auth.subscribe(() => {
    const { session, name } = auth.getState();
    try {
      if (!session) {
        if (wasSignedIn) {
          localStorage.removeItem(USERNAME_STORAGE_KEY);
          localStorage.removeItem(INTRO_COMPLETED_STORAGE_KEY);
        }
        wasSignedIn = false;
        return;
      }
      wasSignedIn = true;
      if (!name) return;
      if (localStorage.getItem(USERNAME_STORAGE_KEY) !== name) localStorage.setItem(USERNAME_STORAGE_KEY, name);
      localStorage.setItem(INTRO_COMPLETED_STORAGE_KEY, 'true');
    } catch {
      // storage blocked: the pages simply ask for a name as before
    }
  });
  void auth.init();
  // Signing in or out in another tab shows up here too.
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY || event.key === null) void auth.init();
  });
}

/** The current visitor: `tier` is "guest", "free" or "premium". */
export function useAuth(): AuthState {
  return useSyncExternalStore(auth.subscribe, auth.getState, auth.getState);
}

/** Headers that tell the server who is asking (nothing for a guest). Used for the requests that depend on the plan. */
export function authHeaders(): Record<string, string> {
  const session = auth.getState().session;
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}
