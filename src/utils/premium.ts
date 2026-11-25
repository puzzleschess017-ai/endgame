// The price of Premium as shown on the site. These are only labels: the price that is really charged is the one set on the
// product in the Dodo dashboard, so change both together.
export const PREMIUM_MONTHLY_CENTS = 499;
export const PREMIUM_YEARLY_CENTS = 3999;

export function priceLabel(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const PREMIUM_MONTHLY_LABEL = priceLabel(PREMIUM_MONTHLY_CENTS);
export const PREMIUM_YEARLY_LABEL = priceLabel(PREMIUM_YEARLY_CENTS);

/** How many percent the yearly plan saves against twelve monthly payments (33). */
export function yearlySavingPercent(monthlyCents = PREMIUM_MONTHLY_CENTS, yearlyCents = PREMIUM_YEARLY_CENTS): number {
  return Math.round((1 - yearlyCents / (monthlyCents * 12)) * 100);
}

export type PremiumPlan = 'monthly' | 'yearly';
