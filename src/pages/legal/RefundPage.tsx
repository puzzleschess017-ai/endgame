import { CONTACT_EMAIL, REFUND_DAYS, REFUND_UPDATED } from '../../site';
import LegalLayout from './LegalLayout';

export default function RefundPage() {
  return (
    <LegalLayout title="Refund and Cancellation Policy" documentTitle="Refund and Cancellation Policy | Chess Tactics Guide">
      <p className="text-sm text-white/60">Last updated: {REFUND_UPDATED}</p>
      <p>
        This page covers the Premium subscription of Chess Tactics Guide: the monthly plan ($4.99 a month) and the
        yearly plan ($39.99 a year). The rest of the site is free.
      </p>

      <h2>Cancelling</h2>
      <ul>
        <li>
          You can cancel at any time: with the Cancel button in the &quot;Your subscription&quot; section of the <a href="/pricing">Pricing</a> page
          (when you are signed in), in Dodo&apos;s customer portal (the link is in your receipt e-mail), or by writing to us.
        </li>
        <li>Cancelling stops the next payment. You keep Premium until the end of the period you have already paid for.</li>
        <li>Nothing is charged after you cancel, and you do not need to give a reason.</li>
        <li>Cancel before the renewal date to avoid the next charge. Your receipt shows when it is.</li>
      </ul>

      <h2>Refunds</h2>
      <ul>
        <li>
          You can ask for a full refund within {REFUND_DAYS} days of your <strong>first payment</strong> for Premium
          (monthly or yearly), without giving a reason.
        </li>
        <li>
          Renewal payments are not refunded. To avoid being charged again, cancel before the renewal date. Your receipt
          shows when it is.
        </li>
        <li>After {REFUND_DAYS} days we do not refund the period you have already paid for, but you can still cancel the next one.</li>
        <li>If you were charged by mistake, or twice, write to us and we will put it right.</li>
        <li>An approved refund is paid back to the card or method you paid with. It can take a few business days to show up.</li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> (or use the <a href="/contact">Contact</a>{' '}
        page) from the e-mail address of your account, and tell us which payment it is about (the date and the amount). We reply within a few
        business days. Because Dodo Payments is the seller of record, the refund is made through them.
      </p>

      <h2>After a refund</h2>
      <p>
        When a payment is refunded we also end the subscription, so you are not charged again, and Premium closes.
        Your free account and your results stay.
      </p>

      <p>
        See also the <a href="/terms">Terms of Service</a> and the <a href="/pricing">Pricing</a> page.
      </p>
    </LegalLayout>
  );
}
