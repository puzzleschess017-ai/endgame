// "Sign in with Lichess" in the browser: the link that starts it, reading the answer the server puts in the
// address of /login (see server/lichess.ts), and asking the server whether it is switched on at all.
import { useEffect, useState } from 'react';
import type { AuthSession } from './client';

/** Where the sign-in starts. The server sends the visitor to Lichess and, afterwards, back to /login. */
export function lichessStartUrl(next: string): string {
  return `/api/auth/lichess/start?next=${encodeURIComponent(next)}`;
}

/** An account made by Lichess sign-in has a made-up address (lichess-<24 letters and digits>@...): it is not shown. */
export function isLichessEmail(email: string): boolean {
  return /^lichess-[0-9a-f]{24}@/i.test(email);
}

/** The session in the fragment of the address ("#access_token=...") when the server has just signed the visitor in. */
export function readLichessSession(hash: string, nowSeconds: number): AuthSession | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const userId = params.get('user_id');
  if (!accessToken || !refreshToken || !userId) return null;
  const expiresAt = Number(params.get('expires_at'));
  const expiresIn = Number(params.get('expires_in'));
  return {
    accessToken,
    refreshToken,
    userId,
    email: params.get('email') ?? '',
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : nowSeconds + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600),
  };
}

const ERROR_TEXT: Record<string, string> = {
  cancelled: 'You did not allow the sign-in on Lichess. Try again when you are ready.',
  expired: 'The sign-in took too long or was interrupted. Please try again.',
  unavailable: 'Sign in with Lichess is not available right now.',
  failed: 'Signing in with Lichess did not work. Please try again.',
};

/** The sentence for ?lichess_error=... in the address, or null when there is none. */
export function lichessErrorText(search: string): string | null {
  const code = new URLSearchParams(search).get('lichess_error');
  if (!code) return null;
  return ERROR_TEXT[code] ?? ERROR_TEXT.failed;
}

let enabled: Promise<boolean> | null = null;

/** True when the server has Lichess sign-in switched on (asked once per page load). */
export function useLichessEnabled(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    enabled ??= fetch('/api/auth/config')
      .then((response) => (response.ok ? (response.json() as Promise<{ lichess?: unknown }>) : { lichess: false }))
      .then((body) => body.lichess === true)
      .catch(() => false);
    void enabled.then((value) => alive && setOn(value));
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
