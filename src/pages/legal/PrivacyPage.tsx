import { PRIVACY_UPDATED } from '../../site';
import { setConsent, useConsent } from '../../utils/consent';
import { SECONDARY_BUTTON_CLASS } from '../../components/panelUi';
import LegalLayout from './LegalLayout';

export default function PrivacyPage() {
  const consent = useConsent();
  return (
    <LegalLayout title="Privacy" documentTitle="Privacy | Chess Tactics Guide">
      <p className="text-sm text-white/60">Last updated: {PRIVACY_UPDATED}</p>
      <p>
        This page explains what Chess Tactics Guide stores about you and why. We keep it to the minimum the site
        needs, and we do not sell your data or show ads.
      </p>

      <h2>Without an account</h2>
      <p>
        Your results, settings and sound choices are saved in your own browser (local storage). They never leave
        your device, and clearing your browser data removes them.
      </p>

      <h2>With an account</h2>
      <ul>
        <li>Your e-mail address, the name you chose and your password (stored only in a protected, hashed form).</li>
        <li>Your plan (Free or Premium) and your training results, so they follow you to other devices.</li>
      </ul>
      <p>
        Accounts and results are stored with our service provider Supabase. The site is hosted on Render. Both
        process data on our behalf to run the site.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        The site itself works without cookies. If you accept, we load Google Analytics (through Google Tag Manager)
        to count visits and see which pages are used. Google then sets cookies in your browser and receives
        technical information such as your approximate location and device, according to Google&apos;s own privacy
        policy. If you decline, nothing from Google is loaded, and if you change your mind later, its cookies are
        removed.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span data-testid="consent-state" className="text-sm font-semibold text-white">
          Your choice: {consent === 'granted' ? 'analytics accepted' : consent === 'denied' ? 'analytics declined' : 'not chosen yet'}
        </span>
        {consent !== 'granted' && (
          <button type="button" onClick={() => setConsent('granted')} className={`${SECONDARY_BUTTON_CLASS} px-4 py-2`}>
            Accept analytics
          </button>
        )}
        {consent !== 'denied' && (
          <button type="button" onClick={() => setConsent('denied')} className={`${SECONDARY_BUTTON_CLASS} px-4 py-2`}>
            Decline analytics
          </button>
        )}
      </div>

      <h2>Your rights</h2>
      <p>
        You can ask us to show, correct or delete the data we hold about you, including your whole account. Use the{' '}
        <a href="/contact">Contact</a> page. You can also delete your results at any time by clearing this site&apos;s
        data in your browser.
      </p>

      <h2>Changes</h2>
      <p>If this page changes in a way that matters, the date above changes with it.</p>
    </LegalLayout>
  );
}
