// Who is using the site: a guest (nobody signed in) or someone signed in, with their plan. One store for the
// whole page, kept in the browser (`ctg_auth_v1`) so a reload keeps you signed in. The store takes its
// parts (client, storage, timers) as arguments, so it can be tested without a browser or a server.
import type { Tier } from '../utils/access';
import type { AuthClient, AuthResult, AuthSession, Profile, SignUpOutcome } from './client';

export const AUTH_STORAGE_KEY = 'ctg_auth_v1';

export interface AuthState {
  /** "loading" only while a signed-in visitor's plan is not known yet (first load after signing in elsewhere). */
  status: 'loading' | 'ready';
  session: AuthSession | null;
  profile: Profile | null;
  /** What the visitor may use: guest when nobody is signed in. */
  tier: Tier;
  /** The name to greet with: the profile name, else the start of the email. */
  name: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AuthStoreParts {
  client: AuthClient;
  storage: KeyValueStorage;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

/** Refresh the access token this long before it ends. */
const REFRESH_MARGIN_SECONDS = 90;
const RETRY_MS = 30_000;

export function nameFor(session: AuthSession | null, profile: Profile | null): string {
  if (!session) return '';
  const fromProfile = profile?.name.trim();
  return fromProfile || session.email.split('@')[0] || '';
}

function deriveState(session: AuthSession | null, profile: Profile | null): AuthState {
  if (!session) return { status: 'ready', session: null, profile: null, tier: 'guest', name: '' };
  return {
    status: profile ? 'ready' : 'loading',
    session,
    profile,
    tier: profile?.plan ?? 'free',
    name: nameFor(session, profile),
  };
}

function parseSaved(raw: string | null): { session: AuthSession; profile: Profile | null } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { session?: Partial<AuthSession>; profile?: Partial<Profile> | null };
    const s = data.session;
    if (!s || typeof s.accessToken !== 'string' || typeof s.refreshToken !== 'string' || typeof s.expiresAt !== 'number' || typeof s.userId !== 'string') {
      return null;
    }
    const p = data.profile;
    const profile: Profile | null =
      p && typeof p.name === 'string' && (p.plan === 'free' || p.plan === 'premium') ? { name: p.name, plan: p.plan } : null;
    return {
      session: { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt, userId: s.userId, email: typeof s.email === 'string' ? s.email : '' },
      profile,
    };
  } catch {
    return null;
  }
}

export function createAuthStore(parts: AuthStoreParts) {
  const { client, storage } = parts;
  const now = parts.now ?? (() => Math.floor(Date.now() / 1000));
  const setTimer = parts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = parts.clearTimer ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let state: AuthState = deriveState(null, null);
  let timer: unknown = null;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());

  function persist(): void {
    try {
      if (state.session) storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ session: state.session, profile: state.profile }));
      else storage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // storage may be full or blocked: the visitor just has to sign in again next time
    }
  }

  function set(session: AuthSession | null, profile: Profile | null): void {
    state = deriveState(session, profile);
    persist();
    schedule();
    emit();
  }

  function schedule(): void {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (!state.session) return;
    const wait = Math.max(5, state.session.expiresAt - REFRESH_MARGIN_SECONDS - now());
    timer = setTimer(() => void refreshNow(), wait * 1000);
  }

  async function refreshNow(): Promise<void> {
    const session = state.session;
    if (!session) return;
    const result = await client.refresh(session.refreshToken);
    if (!state.session || state.session.userId !== session.userId) return; // signed out or switched meanwhile
    if (result.ok) {
      state = { ...state, session: result.value };
      persist();
      schedule();
      emit();
    } else if (result.rejected) {
      set(null, null);
    } else {
      timer = setTimer(() => void refreshNow(), RETRY_MS);
    }
  }

  async function loadProfile(): Promise<void> {
    const session = state.session;
    if (!session) return;
    const result = await client.fetchProfile(session);
    if (!state.session || state.session.userId !== session.userId) return;
    if (result.ok) {
      state = deriveState(state.session, result.value);
      persist();
      emit();
    } else if (result.rejected) {
      await refreshNow();
    } else if (state.status === 'loading') {
      // The plan could not be read. Until it can, the visitor is treated as signed in on the free plan.
      state = { ...state, status: 'ready' };
      emit();
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Reads the saved sign-in and checks it. Call once when the page starts, and again when another tab changes it. */
    async init(): Promise<void> {
      const saved = parseSaved(storage.getItem(AUTH_STORAGE_KEY));
      if (!saved) {
        set(null, null);
        return;
      }
      set(saved.session, saved.profile);
      if (saved.session.expiresAt - REFRESH_MARGIN_SECONDS <= now()) await refreshNow();
      if (state.session) await loadProfile();
    },

    async signIn(email: string, password: string): Promise<AuthResult<AuthSession>> {
      const result = await client.signIn({ email, password });
      if (!result.ok) return result;
      set(result.value, null);
      await loadProfile();
      return result;
    },

    /** `session: null` in the answer means the email has to be confirmed before signing in. */
    async signUp(email: string, password: string, name: string): Promise<AuthResult<SignUpOutcome>> {
      const result = await client.signUp({ email, password, name });
      if (!result.ok) return result;
      if (result.value.session) {
        set(result.value.session, null);
        await loadProfile();
      }
      return result;
    },

    /** Asks again which plan the account has (after a payment, when the plan may just have changed). */
    async refreshPlan(): Promise<void> {
      await loadProfile();
    },

    async signOut(): Promise<void> {
      const session = state.session;
      set(null, null);
      if (session) await client.signOut(session.accessToken);
    },

    /** Changes the name shown to the visitor (saved on the profile). */
    async rename(name: string): Promise<AuthResult<true>> {
      const session = state.session;
      if (!session) return { ok: false, error: 'You are not signed in.' };
      const result = await client.updateName(session, name);
      if (result.ok && state.session) {
        state = deriveState(state.session, { name: name.trim(), plan: state.profile?.plan ?? 'free' });
        persist();
        emit();
      }
      return result;
    },
  };
}

export type AuthStore = ReturnType<typeof createAuthStore>;
