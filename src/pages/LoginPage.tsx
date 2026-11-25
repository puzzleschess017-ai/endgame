import { useEffect, useState, type FormEvent } from 'react';
import { Crown, LogOut, UserRound } from 'lucide-react';
import AppShell from '../components/AppShell';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, segmentClass } from '../components/panelUi';
import { auth, useAuth } from '../auth';
import { chooseGuest } from '../auth/guest';
import { signOutAndSync, useSyncState } from '../sync';
import { readSavedUsername } from '../utils/profile';

type Mode = 'signin' | 'signup';

const INPUT_CLASS =
  'w-full rounded-xl bg-[#101b2f] border border-white/20 focus:border-[#39ff88] focus:ring-2 focus:ring-[#39ff88]/25 focus:outline-none px-4 py-3 text-base font-semibold text-white placeholder:text-white/40 min-h-[48px]';

const PLAN_NAME = { free: 'Free', premium: 'Premium' } as const;

/** Where to go after signing in: a path of this site given as ?next=/streak, else Home. */
export function nextPath(search: string): string {
  const next = new URLSearchParams(search).get('next') ?? '';
  return /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(next) ? next : '/';
}

/** Sign in, create an account, or carry on as a guest; and, for someone signed in, the account. */
export default function LoginPage() {
  const state = useAuth();
  const syncState = useSyncState();
  const [mode, setMode] = useState<Mode>(() => (new URLSearchParams(window.location.search).get('tab') === 'signup' ? 'signup' : 'signin'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sign in | Chess Tactics Guide';
  }, []);

  const goNext = () => window.location.assign(nextPath(window.location.search));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter the name you want to be greeted with.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') {
        const result = await auth.signIn(email, password);
        if (result.ok) goNext();
        else setError(result.error);
      } else {
        const result = await auth.signUp(email, password, name);
        if (!result.ok) setError(result.error);
        else if (result.value.session) goNext();
        else {
          setMode('signin');
          setPassword('');
          setNotice(`We sent a confirmation link to ${email.trim()}. Open it, then come back here and sign in.`);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const signedIn = state.session !== null;

  return (
    <AppShell username={state.name || readSavedUsername()}>
      <div className="max-w-[440px] mx-auto flex flex-col gap-5" data-testid="login">
        {signedIn ? (
          <div className={CARD_CLASS} data-testid="account">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-[#39ff88]/15 flex items-center justify-center shrink-0">
                <UserRound className="w-6 h-6 text-[#39ff88]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white tracking-tight truncate" data-testid="account-name">
                  {state.name}
                </h2>
                <p className="text-sm font-medium text-white/70 truncate" data-testid="account-email">
                  {state.session?.email}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold text-white/85">
              Plan:{' '}
              <span
                data-testid="account-plan"
                className={state.tier === 'premium' ? 'text-amber-300' : 'text-[#39ff88]'}
              >
                {state.status === 'loading' ? '…' : PLAN_NAME[state.tier === 'premium' ? 'premium' : 'free']}
              </span>
            </p>
            <p
              data-testid="sync-status"
              data-status={syncState.status}
              className={`text-sm font-medium leading-snug ${syncState.status === 'error' ? 'text-[#ffd2cc]' : 'text-white/70'}`}
            >
              {syncState.status === 'saved'
                ? 'Your results are saved on this account and follow you to every device.'
                : syncState.status === 'error'
                  ? `Your results could not be saved on the account yet (${syncState.error}) They stay in this browser and we will try again.`
                  : 'Saving your results on the account…'}
            </p>
            <a href="/" className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center no-underline`}>
              Continue
            </a>
            <button
              type="button"
              data-testid="sign-out"
              onClick={() => void signOutAndSync()}
              className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center gap-2`}
            >
              <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        ) : (
          <div className={CARD_CLASS}>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Welcome</h2>
              <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
                Sign in to keep your results on every device and unlock more training options.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10" role="group" aria-label="Sign in or create an account">
              <button type="button" data-testid="tab-signin" aria-pressed={mode === 'signin'} onClick={() => { setMode('signin'); setError(null); }} className={segmentClass(mode === 'signin')}>
                Sign in
              </button>
              <button type="button" data-testid="tab-signup" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(null); setNotice(null); }} className={segmentClass(mode === 'signup')}>
                Create account
              </button>
            </div>

            <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
              {mode === 'signup' && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="auth-name" className="text-sm font-bold text-white">
                    Your name
                  </label>
                  <input
                    id="auth-name"
                    data-testid="auth-name"
                    type="text"
                    maxLength={32}
                    autoComplete="nickname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How should we greet you?"
                    className={INPUT_CLASS}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-email" className="text-sm font-bold text-white">
                  Email
                </label>
                <input
                  id="auth-email"
                  data-testid="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="auth-password" className="text-sm font-bold text-white">
                  Password
                </label>
                <input
                  id="auth-password"
                  data-testid="auth-password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={INPUT_CLASS}
                />
              </div>

              {error && (
                <p role="alert" data-testid="auth-error" className="text-sm font-semibold text-[#ffd2cc] bg-[#401a22] border border-[#8f3848] rounded-xl px-3.5 py-2.5">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" data-testid="auth-notice" className="text-sm font-semibold text-[#d6ffe6] bg-[#12382a] border border-[#39ff88]/40 rounded-xl px-3.5 py-2.5">
                  {notice}
                </p>
              )}

              <button type="submit" data-testid="auth-submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs font-semibold text-white/50" aria-hidden="true">
              <span className="h-px flex-1 bg-white/15" /> or <span className="h-px flex-1 bg-white/15" />
            </div>

            <div className="flex flex-col gap-2">
              <a href="/" data-testid="play-as-guest" onClick={chooseGuest} className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center no-underline`}>
                Play as a guest
              </a>
              <p className="text-xs font-medium text-white/60 leading-relaxed">
                Guests can use Woodpecker (Classic puzzles, easy and medium), Puzzle Streak, Puzzle Race, Coordinate
                Training, the Board Editor and Board Analysis. Results stay in this browser.
              </p>
            </div>
          </div>
        )}
        {signedIn && state.status !== 'loading' && state.tier === 'free' && (
          <a
            href="/pricing"
            data-testid="account-get-premium"
            className="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-[#16233b] px-5 py-3.5 text-sm font-bold text-amber-300 no-underline hover:bg-[#1b2b47]"
          >
            <Crown className="w-4 h-4" aria-hidden="true" /> Get Premium
          </a>
        )}
      </div>
    </AppShell>
  );
}
