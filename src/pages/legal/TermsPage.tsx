import { CONTACT_EMAIL, REFUND_DAYS, TERMS_UPDATED } from '../../site';
import LegalLayout from './LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" documentTitle="Terms of Service | Chess Tactics Guide">
      <p className="text-sm text-white/60">Last updated: {TERMS_UPDATED}</p>
      <p>
        These terms apply when you use Chess Tactics Guide (the &quot;site&quot;). By using the site or buying
        Premium you agree to them. If you do not agree, please do not use the site.
      </p>

      <h2>The site</h2>
      <p>
        The site offers chess training: puzzles, the Woodpecker method, blindfold drills, endgame and opening
        lessons and a board analysis tool. Most of it is free and works without an account. We may change, add or
        remove features at any time, and we do not promise that the site is always available or free of errors.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your password safe and for what happens under your account. Give us a real
        e-mail address, and do not use the site to break the law, to harm the site or other people, or to copy it
        automatically at scale.
      </p>

      <h2>Premium</h2>
      <ul>
        <li>Premium is a subscription, billed every month ($4.99) or every year ($39.99), in US dollars.</li>
        <li>
          It opens every Woodpecker and Blindfold option and lets you download the e-books for as long as the
          subscription is active.
        </li>
        <li>
          The subscription renews by itself at the end of each period until you cancel it. You can cancel at any
          time and keep Premium until the end of the period you have paid for.
        </li>
        <li>
          Prices may change. A change applies to the next period after we tell you, and never to a period you have
          already paid for.
        </li>
      </ul>

      <h2>Payment</h2>
      <p>
        Payments are handled by our payment provider Dodo Payments, which is the seller of record for Premium. It
        collects the payment, charges the applicable VAT or sales tax and issues your receipt. We never see or store
        your card number. Dodo&apos;s own terms and privacy policy apply to the payment itself.
      </p>

      <h2>Refunds and cancelling</h2>
      <p>
        You may ask for a refund within {REFUND_DAYS} days of your first Premium payment. Renewals are not refunded, so cancel
        before the renewal date if you do not want to continue. The details, and how to cancel, are on the{' '}
        <a href="/refunds">Refund and Cancellation Policy</a> page.
      </p>

      <h2>Content and e-books</h2>
      <p>
        The site, the lessons and the e-books are ours or are used with permission. Puzzles come from the open
        Lichess database. With Premium you get a personal licence to read and use the e-books for your own training.
        Please do not share, resell or publish them.
      </p>

      <h2>No guarantee</h2>
      <p>
        Chess training takes work, and we cannot promise that you will reach a certain rating. The site is provided
        &quot;as is&quot;. To the extent the law allows, we are not liable for indirect or lost-profit damages, and
        our total liability for Premium is limited to what you paid us in the last 12 months.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can stop using the site and ask us to delete your account at any time. We may suspend an account that
        breaks these terms.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If these terms change in a way that matters, the date above changes with it. Questions go to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or the <a href="/contact">Contact</a> page. See also
        the <a href="/privacy">Privacy</a> page.
      </p>
    </LegalLayout>
  );
}
