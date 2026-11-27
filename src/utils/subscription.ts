// The Premium subscription as the account section of the Pricing page shows it. The server (GET /api/subscription and
// POST /api/subscription/cancel) gives the same small answer to both: whether there is a subscription to manage here,
// when the next payment (or, once cancelled, the end of the paid period) is, and whether it is already cancelled.

export interface SubscriptionInfo {
  /** False when this account has no subscription of its own to manage here (for example Premium given by hand). */
  managed: boolean;
  /** An ISO date, or null when Dodo did not say. */
  nextBillingDate: string | null;
  cancelScheduled: boolean;
}

/** Reads the answer of the server; anything that is not the expected shape is treated as "nothing to manage". */
export function parseSubscription(body: unknown): SubscriptionInfo {
  const raw = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const date = typeof raw.nextBillingDate === 'string' && !Number.isNaN(Date.parse(raw.nextBillingDate)) ? raw.nextBillingDate : null;
  return { managed: raw.managed === true, nextBillingDate: date, cancelScheduled: raw.cancelScheduled === true };
}

/** "December 27, 2026". The date is shown in the person's own time zone, as it is the day they will see on their calendar. */
export function formatLongDate(iso: string, locale = 'en-US'): string {
  return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** What the card says about the subscription (the date part, or a plain fallback when Dodo gave no date). */
export function subscriptionSentence(info: SubscriptionInfo): string {
  const date = info.nextBillingDate ? formatLongDate(info.nextBillingDate) : null;
  if (info.cancelScheduled) {
    return date
      ? `Your subscription is cancelled. You keep Premium until ${date}, and you will not be charged again.`
      : 'Your subscription is cancelled. You keep Premium until the end of the period you have paid for, and you will not be charged again.';
  }
  return date ? `Your subscription renews on ${date}.` : 'Your subscription renews automatically.';
}
