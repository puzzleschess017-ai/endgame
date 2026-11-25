// The name in the menu. For a guest it is a link to the sign-in page. For someone signed in it opens a small menu with the
// account (name, email, plan), a way to change the name, and the places that belong to the account. A crown next to the
// name shows that the account has Premium.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChartColumn, Check, Crown, LogIn, LogOut, Pencil, UserRound } from 'lucide-react';
import { auth, useAuth } from '../auth';
import { signOutAndSync } from '../sync';

/** A small amber crown, for the names of Premium accounts. */
export function PremiumCrown({ className = 'w-4 h-4' }: { className?: string }) {
  return <Crown data-testid="premium-crown" className={`${className} text-amber-300 shrink-0`} aria-label="Premium" role="img" />;
}

const ITEM =
  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-semibold text-white/85 hover:text-white hover:bg-white/5 cursor-pointer no-underline text-left focus-visible:outline-2 focus-visible:outline-[#39ff88]';

interface ProfileMenuProps {
  /** The name to show when nobody is signed in (the name saved in this browser). */
  guestName?: string;
  /** Which edge of the button the menu lines up with. */
  align: 'left' | 'right';
  className?: string;
  testId?: string;
}

export default function ProfileMenu({ guestName, align, className = '', testId = 'sidebar-name' }: ProfileMenuProps) {
  const { session, name, tier } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setEditing(false);
      setError(null);
    };
    const onPointer = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Only the person icon, like the sign-out and volume buttons next to it.
  const buttonClass =
    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white/85 hover:text-[#39ff88] hover:bg-[#16233b] border border-transparent hover:border-white/15 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#39ff88]';
  const icon = <UserRound className="w-4 h-4" aria-hidden="true" />;

  if (!session) {
    return (
      <div ref={box} className={`relative shrink-0 ${className}`}>
        <button
          type="button"
          data-testid={testId}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Sign in or create an account"
          onClick={() => setOpen((v) => !v)}
          aria-label={guestName || 'Guest'}
          className={buttonClass}
        >
          {icon}
        </button>
        {open && (
          <div
            role="menu"
            data-testid="profile-menu"
            className={`absolute z-50 w-[250px] top-full mt-2 ${align === 'left' ? 'left-0' : 'right-0'} bg-[#16233b] border border-white/15 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.6)] p-2 flex flex-col gap-0.5`}
          >
            <a role="menuitem" href="/login" data-testid="guest-sign-in" className={ITEM}>
              <LogIn className="w-4 h-4 text-[#39ff88]" aria-hidden="true" /> Sign in or create an account
            </a>
            <a role="menuitem" href="/statistics" className={ITEM}>
              <ChartColumn className="w-4 h-4 text-emerald-400" aria-hidden="true" /> My statistics
            </a>
          </div>
        )}
      </div>
    );
  }

  const premium = tier === 'premium';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (!next) {
      setError('Please enter a name.');
      return;
    }
    if (next === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await auth.rename(next);
    setBusy(false);
    if (result.ok) setEditing(false);
    else setError(result.error);
  };

  return (
    <div ref={box} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open}
        title="My profile"
        onClick={() => setOpen((v) => !v)}
        aria-label="My profile"
        className={buttonClass}
      >
        {icon}
      </button>

      {open && (
        <div
          role="menu"
          data-testid="profile-menu"
          className={`absolute z-50 w-[250px] top-full mt-2 ${align === 'left' ? 'left-0' : 'right-0'} bg-[#16233b] border border-white/15 rounded-2xl shadow-[0_16px_44px_rgba(4,9,20,0.6)] p-2 flex flex-col gap-0.5`}
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-10 h-10 rounded-full bg-[#39ff88]/15 flex items-center justify-center shrink-0">
              <UserRound className="w-5 h-5 text-[#39ff88]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                <span className="truncate" data-testid="profile-name">{name}</span>
                {premium && <PremiumCrown />}
              </p>
              <p className="text-xs font-medium text-white/60 truncate" data-testid="profile-email">{session.email}</p>
              <p className={`text-xs font-bold ${premium ? 'text-amber-300' : 'text-white/60'}`} data-testid="profile-plan">
                {premium ? 'Premium' : 'Free plan'}
              </p>
            </div>
          </div>
          <div className="h-px bg-white/10 my-1" />

          {editing ? (
            <form onSubmit={save} className="px-2 py-1.5 flex flex-col gap-2" data-testid="profile-rename-form">
              <label htmlFor="profile-name-input" className="text-xs font-bold text-white/70">
                Your name
              </label>
              <input
                id="profile-name-input"
                data-testid="profile-name-input"
                autoFocus
                type="text"
                maxLength={32}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-lg bg-[#101b2f] border border-white/20 focus:border-[#39ff88] focus:outline-none px-3 py-2 text-sm font-semibold text-white min-h-[40px]"
              />
              {error && (
                <p role="alert" data-testid="profile-error" className="text-xs font-semibold text-[#ffd2cc]">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  data-testid="profile-save"
                  className="flex-1 rounded-lg bg-[#39ff88] text-[#06210f] text-sm font-bold py-2 min-h-[40px] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" aria-hidden="true" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  className="rounded-lg border border-white/20 text-white/85 text-sm font-semibold px-3 min-h-[40px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              data-testid="profile-rename"
              className={ITEM}
              onClick={() => {
                setDraft(name);
                setError(null);
                setEditing(true);
              }}
            >
              <Pencil className="w-4 h-4 text-white/60" aria-hidden="true" /> Change name
            </button>
          )}

          <a role="menuitem" href="/pricing" data-testid="profile-plan-link" className={ITEM}>
            <Crown className="w-4 h-4 text-amber-300" aria-hidden="true" /> {premium ? 'Your Premium plan' : 'Get Premium'}
          </a>
          <a role="menuitem" href="/statistics" className={ITEM}>
            <ChartColumn className="w-4 h-4 text-emerald-400" aria-hidden="true" /> My statistics
          </a>
          <div className="h-px bg-white/10 my-1" />
          <button
            type="button"
            role="menuitem"
            data-testid="profile-sign-out"
            className={ITEM}
            onClick={() => void signOutAndSync().then(() => window.location.assign('/'))}
          >
            <LogOut className="w-4 h-4 text-white/60" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
