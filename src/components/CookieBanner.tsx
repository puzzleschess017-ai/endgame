import { useConsent, setConsent } from '../utils/consent';
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panelUi';

/** Asks once whether Google Analytics may be used. Hidden while the welcome window is open. */
export default function CookieBanner({ hidden }: { hidden: boolean }) {
  const consent = useConsent();
  if (hidden || consent !== null) return null;
  return (
    <div
      role="region"
      aria-label="Cookies"
      data-testid="cookie-banner"
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-[560px] rounded-2xl border border-white/15 bg-[#16233b] p-4 shadow-[0_12px_36px_rgba(4,9,20,0.6)] flex flex-col gap-3"
    >
      <p className="text-sm font-medium text-white/85 leading-relaxed">
        We would like to use Google Analytics to see which pages are used, so we can improve the site. It sets cookies
        only if you accept.{' '}
        <a href="/privacy" className="underline underline-offset-2 text-white hover:text-[#39ff88]">
          Privacy
        </a>
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          data-testid="cookie-accept"
          onClick={() => setConsent('granted')}
          className={`${PRIMARY_BUTTON_CLASS} flex-1 py-2.5`}
        >
          Accept
        </button>
        <button
          type="button"
          data-testid="cookie-decline"
          onClick={() => setConsent('denied')}
          className={`${SECONDARY_BUTTON_CLASS} flex-1 py-2.5`}
        >
          Decline
        </button>
      </div>
    </div>
  );
}
