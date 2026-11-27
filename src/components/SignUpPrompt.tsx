// The "Create account" button at the top of a page, for a guest only (see src/utils/signup.ts for the pages). It is a yellow pill, so it is not mistaken for the square green Start button. It shines like the other main buttons, takes the person to the sign-up tab and brings them back to this page afterwards.
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import { showsSignupPrompt, signUpHref } from '../utils/signup';

/** True when this page shows a guest the Create account button (the person icon next to it is left out then: it led to the same place). */
export function useShowsSignUp(path: string): boolean {
  const { tier } = useAuth();
  return tier === 'guest' && showsSignupPrompt(path);
}

export default function SignUpPrompt({ path, className = '' }: { path: string; className?: string }) {
  if (!useShowsSignUp(path)) return null;
  return (
    <a
      href={signUpHref(path)}
      data-testid="topbar-signup"
      title="Free: your results and settings follow you to every device"
      className={`btn-shine [--glow:255,210,63] flex items-center justify-center gap-1.5 shrink-0 min-h-[34px] px-3.5 rounded-full bg-[#ffd23f] hover:bg-[#ffdf6b] text-[#101b2f] text-[13px] font-bold whitespace-nowrap no-underline transition-all duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 shadow-[0_6px_20px_rgba(255,210,63,0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd23f] ${className}`}
    >
      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
      Create account
    </a>
  );
}
