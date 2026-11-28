// The browser side of "Continue with Lichess". The server sends the person back to /login#lichess=<token>&next=<path>
// (see server/lichess.ts); a failure comes as /login?lichess=<reason>.

/** The one-time token and the page to go to afterwards, from the address fragment; null when there is none. */
export function parseLichessHash(hash: string): { token: string; next: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('lichess') ?? '';
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(token)) return null;
  const next = params.get('next') ?? '';
  return { token, next: /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(next) ? next : '/' };
}

const MESSAGES: Record<string, string> = {
  denied: 'Lichess sign-in was cancelled.',
  no_email: 'Your Lichess account has no email address we can use. Add one in your Lichess settings, or sign in with an email and password.',
  other_link: 'Your account is linked to another Lichess account already.',
  unavailable: 'Lichess sign-in is not available right now. Please try again, or sign in with an email and password.',
};

/** What ?lichess=<reason> says: "linked" is good news, the rest are failures. Null when the address has no such reason. */
export function lichessNotice(search: string): { tone: 'ok' | 'error'; text: string } | null {
  const reason = new URLSearchParams(search).get('lichess');
  if (reason === null) return null;
  if (reason === 'linked') return { tone: 'ok', text: 'Your Lichess account is linked. From now on "Continue with Lichess" opens this account.' };
  return { tone: 'error', text: MESSAGES[reason] ?? MESSAGES.unavailable };
}

/** The address that starts the sign-in; it comes back to `next` (a path of this site). */
export function lichessStartHref(next: string): string {
  return next && next !== '/' ? `/auth/lichess?next=${encodeURIComponent(next)}` : '/auth/lichess';
}
