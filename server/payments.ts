// Payments through Dodo Payments (https://dodopayments.com), a merchant of record: Dodo is the seller, collects the card
// payment, handles VAT and sales tax, and pays the money out. The site sells one thing, Premium, as a monthly or a yearly
// subscription (the e-books come with it): the webhook sets the plan in profiles.tier.
// The flow: the page asks POST /api/checkout, the server asks Dodo for a checkout session with the signed-in person's id in
// the metadata, the person pays on Dodo's page, and Dodo calls POST /api/webhooks/dodo. The person can cancel from the
// account page: the webhook saves the id of the subscription, and the cancel stops the renewal at the end of the paid period.
// Everything here is switched off until the environment variables below are set (see .env.example).
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------------------------
// What is for sale
// ---------------------------------------------------------------------------------------------

/** The things the page may ask to buy: Premium for a month or for a year (two products in Dodo). */
export type Offer = 'premium:monthly' | 'premium:yearly';

/** Dodo ids look like pdt_0NdXyz..., pay_..., sub_..., ref_...; only the safe characters are accepted. */
const DODO_ID = /^[A-Za-z0-9_-]{4,64}$/;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_ID_IN_PATH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export interface CheckoutConfig {
  apiKey: string;
  /** https://live.dodopayments.com, or https://test.dodopayments.com for testing. */
  baseUrl: string;
  /** Offer → Dodo product id. */
  offers: Record<string, string>;
}

export interface WebhookConfig {
  secret: string;
  supabaseUrl: string;
  /** The Supabase service role key (a secret: it can write to any row). */
  serviceKey: string;
  /** The Dodo product ids of Premium (the monthly and the yearly product). */
  premiumProducts: string[];
}

export interface PaymentSettings {
  checkout: CheckoutConfig | null;
  webhook: WebhookConfig | null;
}

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/**
 * Dodo's address: the test one when DODO_PAYMENTS_ENVIRONMENT is test_mode (or, when it is not set, when the key starts
 * with dodo_test_), the live one otherwise. DODO_PAYMENTS_API_URL replaces both (only for tests with a fake Dodo).
 */
function dodoBaseUrl(env: Env, apiKey: string): string {
  const custom = clean(env.DODO_PAYMENTS_API_URL).replace(/\/+$/, '');
  if (/^https?:\/\//.test(custom)) return custom;
  const mode = clean(env.DODO_PAYMENTS_ENVIRONMENT).toLowerCase();
  const test = mode ? mode === 'test_mode' || mode === 'test' : apiKey.startsWith('dodo_test_');
  return test ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';
}

/**
 * Reads the settings. Each half is on only when all of its values are there:
 *   checkout: DODO_PAYMENTS_API_KEY and at least one product id
 *   webhook:  DODO_PAYMENTS_WEBHOOK_KEY, SUPABASE_SERVICE_ROLE_KEY and at least one product id
 * Product ids: DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY and DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY (either may be left out: its
 * button then says that it opens soon). DODO_PAYMENTS_ENVIRONMENT=test_mode uses Dodo's test environment.
 */
export function loadPaymentSettings(env: Env, supabaseUrl: string): PaymentSettings {
  const offers: Record<string, string> = {};
  const add = (offer: Offer, id: string | undefined) => {
    const value = clean(id);
    if (DODO_ID.test(value)) offers[offer] = value;
  };
  add('premium:monthly', env.DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY);
  add('premium:yearly', env.DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY);
  const premiumProducts = [...new Set(Object.values(offers))];

  const hasProducts = premiumProducts.length > 0;
  const apiKey = clean(env.DODO_PAYMENTS_API_KEY);
  const secret = clean(env.DODO_PAYMENTS_WEBHOOK_KEY);
  const serviceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    checkout: hasProducts && apiKey ? { apiKey, baseUrl: dodoBaseUrl(env, apiKey), offers } : null,
    webhook: hasProducts && secret && serviceKey ? { secret, supabaseUrl, serviceKey, premiumProducts } : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Checking that a webhook really comes from Dodo (the Standard Webhooks signature)
// ---------------------------------------------------------------------------------------------

export interface WebhookHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

/**
 * True when the request is signed with the secret. The signature is HMAC-SHA256 over "<id>.<timestamp>.<body>", in base64,
 * sent as "v1,<signature>" (several, separated by spaces, are allowed). The key is the base64 part of the "whsec_..." secret.
 * A request older or newer than five minutes is refused.
 */
export function verifyWebhook(
  secret: string,
  headers: WebhookHeaders,
  body: Buffer,
  nowSeconds: number = Date.now() / 1000,
  toleranceSeconds = 300,
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  if (key.length === 0) return false;
  const signed = Buffer.concat([Buffer.from(`${id}.${timestamp}.`, 'utf8'), body]);
  const expected = crypto.createHmac('sha256', key).update(signed).digest();
  return signature
    .split(' ')
    .map((part) => /^v1,(.+)$/.exec(part)?.[1])
    .filter((part): part is string => typeof part === 'string')
    .map((part) => Buffer.from(part, 'base64'))
    .some((candidate) => candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected));
}

// ---------------------------------------------------------------------------------------------
// From a Dodo event to what has to change on the site
// ---------------------------------------------------------------------------------------------

export type PaymentAction = {
  kind: 'set-tier';
  userId: string;
  tier: 'free' | 'premium';
  /** The Dodo subscription behind a Premium event; saved so that the person can cancel it from the account page. */
  subscriptionId?: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function userIdOf(data: Record<string, unknown>): string | null {
  const raw = record(data.metadata)?.user_id;
  return typeof raw === 'string' && USER_ID.test(raw) ? raw.toLowerCase() : null;
}

function idOf(value: unknown): string | null {
  return typeof value === 'string' && DODO_ID.test(value) ? value : null;
}

/** True when a payment's cart holds a Premium product of this site (a payment of this site holds one product). */
function cartHasPremium(data: Record<string, unknown>, premiumProducts: string[]): boolean {
  // Dodo sends product_cart as null in the payment of a checkout session's subscription, so the cart cannot be checked.
  // The offer the server itself put in the checkout's metadata says which product was bought; the event is signed, so
  // that metadata can only be the one this server wrote.
  if (!Array.isArray(data.product_cart)) {
    const offer = record(data.metadata)?.offer;
    return premiumProducts.length > 0 && (offer === 'premium:monthly' || offer === 'premium:yearly');
  }
  const cart = data.product_cart;
  return cart.some((item) => {
    const id = record(item)?.product_id;
    return typeof id === 'string' && premiumProducts.includes(id);
  });
}

/**
 * What an event means for the site, or null when there is nothing to do (an event of no interest, or one that is not
 * about a Premium product of this site). The person is found by the user_id the server put in the checkout's metadata,
 * which Dodo sends back inside the payment and the subscription.
 *   subscription.*      Premium follows the subscription's status, which in Dodo's event is its latest state, so a late or
 *                       repeated event cannot bring back an old state: active turns it on; on_hold, cancelled, expired and
 *                       paused turn it off. A subscription that is cancelled for the end of the paid period stays "active"
 *                       until then, so the person keeps Premium for what was paid. past_due (a renewal failed, grace
 *                       period) changes nothing.
 *   payment.succeeded   a payment of a Premium subscription (the first one and every renewal) turns Premium on; this also
 *                       covers a subscription whose own metadata is empty. A one-time payment changes nothing.
 * Refund events are not handled: Premium ends with the subscription, so when refunding, cancel the subscription in Dodo too.
 */
export function actionFor(event: unknown, premiumProducts: string[]): PaymentAction | null {
  const root = record(event);
  const data = record(root?.data);
  if (!root || !data || typeof root.type !== 'string') return null;
  const type = root.type;

  if (type === 'payment.succeeded') {
    const userId = userIdOf(data);
    if (!cartHasPremium(data, premiumProducts) || !userId || !idOf(data.payment_id)) return null;
    if (data.status !== undefined && data.status !== 'succeeded') return null;
    const subscriptionId = idOf(data.subscription_id) ?? (Array.isArray(data.subscription_ids) ? idOf(data.subscription_ids[0]) : null);
    const inSubscription = subscriptionId !== null || (Array.isArray(data.subscription_ids) && data.subscription_ids.length > 0);
    if (!inSubscription) return null;
    return { kind: 'set-tier', userId, tier: 'premium', ...(subscriptionId ? { subscriptionId } : {}) };
  }

  if (type.startsWith('subscription.')) {
    const productId = idOf(data.product_id);
    const userId = userIdOf(data);
    if (!productId || !premiumProducts.includes(productId) || !userId) return null;
    if (data.status === 'active') {
      const subscriptionId = idOf(data.subscription_id);
      return { kind: 'set-tier', userId, tier: 'premium', ...(subscriptionId ? { subscriptionId } : {}) };
    }
    if (data.status === 'on_hold' || data.status === 'cancelled' || data.status === 'expired' || data.status === 'paused') {
      return { kind: 'set-tier', userId, tier: 'free' };
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------------------------
// Writing the result to Supabase (with the service role key: the person cannot do this from the page)
// ---------------------------------------------------------------------------------------------

export interface PaymentStore {
  /**
   * Applies an action: sets the plan and, when the action carries one, saves the id of the subscription.
   * Throws when Supabase refuses, so the webhook answers with an error and Dodo tries again.
   */
  apply(action: PaymentAction): Promise<void>;
  /** The id of the Dodo subscription saved for the person, or null when there is none. Throws when Supabase cannot be asked. */
  subscriptionIdOf(userId: string): Promise<string | null>;
}

/** Where the id of the person's subscription is kept: in the app_metadata of the Supabase user, which only the server can write. */
const SUBSCRIPTION_KEY = 'dodo_subscription_id';

export function createPaymentStore(options: { url: string; serviceKey: string; fetchImpl?: typeof fetch }): PaymentStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/+$/, '');
  // A legacy service role key is a JWT and is also sent as the bearer token; a new "sb_secret_..." key only goes in apikey.
  const headers: Record<string, string> = { apikey: options.serviceKey, 'Content-Type': 'application/json' };
  if (options.serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${options.serviceKey}`;

  async function send(path: string, init: { method: string; body?: unknown; prefer?: string }): Promise<Response> {
    const res = await fetchImpl(`${base}/${path}`, {
      method: init.method,
      headers: init.prefer ? { ...headers, Prefer: init.prefer } : headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Supabase answered ${res.status} for ${init.method} ${path.split('?')[0].replace(USER_ID_IN_PATH, ':id')}`);
    return res;
  }

  /** The app_metadata of a user (the Supabase admin API; the person is found by the id the server has checked). */
  async function readMetadata(userId: string): Promise<Record<string, unknown>> {
    const res = await send(`auth/v1/admin/users/${userId}`, { method: 'GET' });
    return record(record(await res.json())?.app_metadata) ?? {};
  }

  return {
    async apply(action) {
      await send(`rest/v1/profiles?id=eq.${action.userId}`, { method: 'PATCH', prefer: 'return=minimal', body: { tier: action.tier } });
      if (action.subscriptionId) {
        // Read, add one key, write everything back: the other keys (provider, providers) must stay as they are.
        const metadata = await readMetadata(action.userId);
        if (metadata[SUBSCRIPTION_KEY] !== action.subscriptionId) {
          await send(`auth/v1/admin/users/${action.userId}`, {
            method: 'PUT',
            body: { app_metadata: { ...metadata, [SUBSCRIPTION_KEY]: action.subscriptionId } },
          });
        }
      }
    },
    async subscriptionIdOf(userId) {
      if (!USER_ID.test(userId)) return null;
      return idOf((await readMetadata(userId.toLowerCase()))[SUBSCRIPTION_KEY]);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The person's subscription: looking at it and cancelling it (from the account page)
// ---------------------------------------------------------------------------------------------

/** What is needed to talk to Dodo: its address and the API key (the same ones as for a checkout). */
export type DodoApi = Pick<CheckoutConfig, 'apiKey' | 'baseUrl'>;

export interface SubscriptionState {
  /** The id of the subscription in Dodo. */
  id: string;
  /** The person it belongs to, from the metadata the server put in the checkout. */
  userId: string | null;
  /** True while the subscription is running (Dodo status "active"); a cancelled one that is still paid for is also active. */
  active: boolean;
  /** When the next payment is due, or, when the cancel is scheduled, when the paid period ends (an ISO date). */
  nextBillingDate: string | null;
  /** True when the subscription is cancelled for the end of the paid period. */
  cancelScheduled: boolean;
}

/** The subscription as the account page shows it. */
export interface SubscriptionView {
  /** False when there is no subscription of this person to manage here. */
  managed: boolean;
  nextBillingDate: string | null;
  cancelScheduled: boolean;
}

export const NO_SUBSCRIPTION: SubscriptionView = { managed: false, nextBillingDate: null, cancelScheduled: false };

export function subscriptionView(state: SubscriptionState | null): SubscriptionView {
  return state ? { managed: true, nextBillingDate: state.nextBillingDate, cancelScheduled: state.cancelScheduled } : NO_SUBSCRIPTION;
}

function dodoHeaders(api: DodoApi): Record<string, string> {
  return { Authorization: `Bearer ${api.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };
}

function dateOf(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

/** Asks Dodo about a subscription. Null when Dodo has no such subscription (404); throws on any other failure. */
export async function fetchSubscription(api: DodoApi, id: string, fetchImpl: typeof fetch = fetch): Promise<SubscriptionState | null> {
  if (!DODO_ID.test(id)) return null;
  const res = await fetchImpl(`${api.baseUrl}/subscriptions/${encodeURIComponent(id)}`, {
    headers: dodoHeaders(api),
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Dodo answered ${res.status} when reading a subscription`);
  const data = record(await res.json());
  if (!data) throw new Error('Dodo gave no subscription');
  const raw = record(data.metadata)?.user_id;
  return {
    id,
    userId: typeof raw === 'string' && USER_ID.test(raw) ? raw.toLowerCase() : null,
    active: data.status === 'active',
    nextBillingDate: dateOf(data.next_billing_date),
    cancelScheduled: data.cancel_at_next_billing_date === true,
  };
}

/** Cancels a subscription at the end of the paid period (the person keeps Premium until then). Throws when Dodo refuses. */
export async function cancelSubscription(api: DodoApi, id: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!DODO_ID.test(id)) throw new Error('Not a subscription id');
  const res = await fetchImpl(`${api.baseUrl}/subscriptions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: dodoHeaders(api),
    body: JSON.stringify({ cancel_at_next_billing_date: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Dodo answered ${res.status} when cancelling a subscription`);
}

/**
 * The running subscription of a person, or null when there is none to manage: nothing saved for them (Premium given by
 * hand, or a payment from before the id was saved), Dodo does not know it, it belongs to somebody else, or it has ended.
 * The owner is checked against Dodo's own record, so a saved id can never reach another person's subscription.
 */
export async function subscriptionOf(options: { store: PaymentStore; api: DodoApi; userId: string; fetchImpl?: typeof fetch }): Promise<SubscriptionState | null> {
  const id = await options.store.subscriptionIdOf(options.userId);
  if (!id) return null;
  const state = await fetchSubscription(options.api, id, options.fetchImpl);
  if (!state || !state.active || state.userId !== options.userId.toLowerCase()) return null;
  return state;
}

export type CancelResult = { ok: true; view: SubscriptionView } | { ok: false; status: number; error: string };

/**
 * Cancels the person's subscription for the end of the paid period. The person keeps Premium until then; when the period
 * ends Dodo sends subscription.expired (or cancelled), and the webhook turns Premium off. Asking twice is not an error.
 */
export async function cancelUserSubscription(options: { store: PaymentStore; api: DodoApi; userId: string; fetchImpl?: typeof fetch }): Promise<CancelResult> {
  let state: SubscriptionState | null;
  try {
    state = await subscriptionOf(options);
  } catch (err) {
    console.error('[payments] could not read the subscription', err instanceof Error ? err.message : err);
    return { ok: false, status: 502, error: 'Your subscription could not be checked just now. Please try again.' };
  }
  if (!state) return { ok: false, status: 404, error: 'There is no subscription to cancel on this account.' };
  if (state.cancelScheduled) return { ok: true, view: subscriptionView(state) };
  try {
    await cancelSubscription(options.api, state.id, options.fetchImpl);
  } catch (err) {
    console.error('[payments] could not cancel the subscription', err instanceof Error ? err.message : err);
    return { ok: false, status: 502, error: 'The subscription could not be cancelled just now. Please try again.' };
  }
  return { ok: true, view: subscriptionView({ ...state, cancelScheduled: true }) };
}

// ---------------------------------------------------------------------------------------------
// Asking Dodo for a checkout
// ---------------------------------------------------------------------------------------------

export interface CheckoutRequest {
  config: CheckoutConfig;
  offer: string;
  productId: string;
  userId: string;
  email?: string;
  /** Where Dodo sends the person after the payment (Dodo adds the result to this address). */
  returnUrl: string;
  /** Where the "back" button of the checkout goes. */
  cancelUrl: string;
  fetchImpl?: typeof fetch;
}

/** Makes a checkout session for one product and returns the address of its page. Throws when Dodo does not give one. */
export async function createCheckout(request: CheckoutRequest): Promise<string> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const res = await fetchImpl(`${request.config.baseUrl}/checkouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${request.config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      product_cart: [{ product_id: request.productId, quantity: 1 }],
      ...(request.email ? { customer: { email: request.email } } : {}),
      metadata: { user_id: request.userId, offer: request.offer },
      return_url: request.returnUrl,
      cancel_url: request.cancelUrl,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Dodo answered ${res.status} when making a checkout`);
  const url = ((await res.json()) as { checkout_url?: unknown }).checkout_url;
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Dodo gave no checkout address');
  return url;
}
