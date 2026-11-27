// The green "Create account" button at the top of a page, for a guest only (see src/utils/signup.ts for the pages). It
// shines like the other main buttons, takes the person to the sign-up tab and brings them back to this page afterwards.
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import { showsSignupPrompt, signUpHref } from '../utils/signup';

export default function SignUpPrompt({ path, className = '' }: { path: string; className?: string }) {
  const { tier } = useAuth();
  if (tier !== 'guest' || !showsSignupPrompt(path)) return null;
  return (
    <a
      href={signUpHref(path)}
      data-testid="topbar-signup"
      title="Free: your results and settings follow you to every device"
      className={`btn-shine flex items-center justify-center gap-1.5 shrink-0 min-h-[34px] px-3 rounded-lg bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] text-[13px] font-bold whitespace-nowrap no-underline shadow-[0_6px_20px_rgba(57,255,136,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88] ${className}`}
    >
      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
      Create account
    </a>
  );
}
