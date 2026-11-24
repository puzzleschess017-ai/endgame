import { CONTACT_EMAIL } from '../../site';
import LegalLayout from './LegalLayout';

export default function ContactPage() {
  return (
    <LegalLayout title="Contact" documentTitle="Contact | Chess Tactics Guide">
      <p>
        Found a bug, have an idea, or want your account data removed? We read every message.
      </p>
      {CONTACT_EMAIL ? (
        <p>
          Write to <a href={`mailto:${CONTACT_EMAIL}`} data-testid="contact-email">{CONTACT_EMAIL}</a>.
        </p>
      ) : (
        <p data-testid="contact-pending">The contact e-mail address will be published here soon.</p>
      )}
      <p>
        When you report a problem, it helps to say which page you were on, what you clicked, and which device and
        browser you use.
      </p>
    </LegalLayout>
  );
}
