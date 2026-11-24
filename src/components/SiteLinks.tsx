import { LEGAL_LINKS } from '../site';
import { setConsent } from '../utils/consent';

/** About, Privacy and Contact, plus a way to change the cookie choice. Sits at the end of the page. */
export default function SiteLinks({ className = '', cookies = true }: { className?: string; cookies?: boolean }) {
  return (
    <footer className={`flex-wrap items-center justify-center gap-x-4 gap-y-0 text-xs font-semibold text-white/60 ${className}`}>
      {LEGAL_LINKS.map((link) => (
        <a key={link.href} href={link.href} className="py-1.5 text-white/70 no-underline hover:text-[#39ff88]">
          {link.label}
        </a>
      ))}
      {cookies && (
        <button
          type="button"
          data-testid="cookie-settings"
          onClick={() => setConsent(null)}
          className="py-1.5 text-white/70 hover:text-[#39ff88] cursor-pointer"
        >
          Cookies
        </button>
      )}
    </footer>
  );
}
