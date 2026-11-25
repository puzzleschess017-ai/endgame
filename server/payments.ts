// Payments through Dodo Payments (https://dodopayments.com), a merchant of record: Dodo is the seller, collects the card
// payment, handles VAT and sales tax, and pays the money out. One provider sells both things of this site:
//   - an e-book (a one-time product): the webhook writes a row to ebook_purchases,
//   - Premium (a monthly or yearly subscription): the webhook sets the plan in profiles.tier.
// The flow: the page asks POST /api/checkout, the server asks Dodo for a checkout session with the signed-in person's id in
// the metadata, the person pays on Dodo's page, and Dodo calls POST /api/webhooks/dodo. Everything here is switched off
// until the environment variables below are set (see .env.example).
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------------------------
// What is for sale
// ---------------------------------------------------------------------------------------------

/** What a Dodo product is: one e-book, or Premium (the monthly and the yearly product are both Premium). */
export type Product = { kind: 'ebook'; slug: string } | { kind: 'premium' };

/** The things the page may ask to buy: `ebook:<slug>`, `premium:monthly`, `premium:yearly`. */
export type Offer = `ebook:${string}` | 'premium:monthly' | 'premium:yearly';

/** Dodo ids look like pdt_0NdXyz..., pay_..., sub_..., ref_...; only the safe characters are accepted. */
const DODO_ID = /^[A-Za-z0-9_-]{4,64}$/;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  /** Dodo product id → what it is. */
  products: Record<string, Product>;
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
 * Product ids: DODO_PAYMENTS_PRODUCT_EBOOK_<SLUG> (the slug in capitals, - as _), DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY,
 * DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY. DODO_PAYMENTS_ENVIRONMENT=test_mode uses Dodo's test environment.
 */
export function loadPaymentSettings(env: Env, ebookSlugs: string[], supabaseUrl: string): PaymentSettings {
  const offers: Record<string, string> = {};
  const products: Record<string, Product> = {};
  const add = (offer: Offer, product: Product, id: string | undefined) => {
    const value = clean(id);
    if (!DODO_ID.test(value)) return;
    offers[offer] = value;
    products[value] = product;
  };
  for (const slug of ebookSlugs) {
    add(`ebook:${slug}`, { kind: 'ebook', slug }, env[`DODO_PAYMENTS_PRODUCT_EBOOK_${slug.toUpperCase().replace(/-/g, '_')}`]);
  }
  add('premium:monthly', { kind: 'premium' }, env.DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY);
  add('premium:yearly', { kind: 'premium' }, env.DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY);

  const hasProducts = Object.keys(offers).length > 0;
  const apiKey = clean(env.DODO_PAYMENTS_API_KEY);
  const secret = clean(env.DODO_PAYMENTS_WEBHOOK_KEY);
  const serviceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    checkout: hasProducts && apiKey ? { apiKey, baseUrl: dodoBaseUrl(env, apiKey), offers } : null,
    webhook: hasProducts && secret && serviceKey ? { secret, supabaseUrl, serviceKey, products } : null,
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

export type PaymentAction =
  | { kind: 'grant-ebook'; userId: string; slug: string; ref: string }
  | { kind: 'revoke-ebook'; ref: string }
  | { kind: 'set-tier'; userId: string; tier: 'free' | 'premium' };

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

/** The site's product in a payment's cart (a payment of this site holds one product). */
function productInCart(data: Record<string, unknown>, products: Record<string, Product>): Product | null {
  const cart = Array.isArray(data.product_cart) ? data.product_cart : [];
  for (const item of cart) {
    const id = record(item)?.product_id;
    if (typeof id === 'string' && Object.hasOwn(products, id)) return products[id];
  }
  return null;
}

/**
 * What an event means for the site, or null when there is nothing to do (an event of no interest, or one that is not
 * about a product of this site). The person is found by the user_id the server put in the checkout's metadata, which
 * Dodo sends back inside the payment, the subscription and the refund.
 *   payment.succeeded   an e-book was paid: the person owns it. A payment of a Premium subscription turns Premium on
 *                       (the first payment and every renewal; this also covers a subscription whose own metadata is empty).
 *   refund.succeeded    a full refund of an e-book payment: the person no longer owns it. (A partial refund changes nothing.)
 *   subscription.*      Premium follows the subscription's status, which in Dodo's event is its latest state, so a late or
 *                       repeated event cannot bring back an old state: active turns it on; on_hold, cancelled, expired and
 *                       paused turn it off. A subscription that is cancelled for the end of the paid period stays "active"
 *                       until then, so the person keeps Premium for what was paid. past_due (a renewal failed, grace
 *                       period) changes nothing.
 */
export function actionFor(event: unknown, products: Record<string, Product>): PaymentAction | null {
  const root = record(event);
  const data = record(root?.data);
  if (!root || !data || typeof root.type !== 'string') return null;
  const type = root.type;

  if (type === 'payment.succeeded') {
    const product = productInCart(data, products);
    const userId = userIdOf(data);
    const paymentId = idOf(data.payment_id);
    if (!product || !userId || !paymentId) return null;
    if (data.status !== undefined && data.status !== 'succeeded') return null;
    if (product.kind === 'ebook') return { kind: 'grant-ebook', userId, slug: product.slug, ref: paymentId };
    const inSubscription = idOf(data.subscription_id) !== null || (Array.isArray(data.subscription_ids) && data.subscription_ids.length > 0);
    return inSubscription ? { kind: 'set-tier', userId, tier: 'premium' } : null;
  }

  if (type === 'refund.succeeded') {
    const paymentId = idOf(data.payment_id);
    if (!paymentId || data.is_partial === true) return null;
    if (data.status !== undefined && data.status !== 'succeeded') return null;
    // Only an e-book is ever stored under a payment id, so a refund of anything else matches no row.
    return { kind: 'revoke-ebook', ref: paymentId };
  }

  if (type.startsWith('subscription.')) {
    const productId = idOf(data.product_id);
    const product = productId && Object.hasOwn(products, productId) ? products[productId] : null;
    const userId = userIdOf(data);
    if (product?.kind !== 'premium' || !userId) return null;
    if (data.status === 'active') return { kind: 'set-tier', userId, tier: 'premium' };
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
  /** Applies an action. Throws when Supabase refuses, so the webhook answers with an error and Dodo tries again. */
  apply(action: PaymentAction): Promise<void>;
}

export function createPaymentStore(options: { url: string; serviceKey: string; fetchImpl?: typeof fetch }): PaymentStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/+$/, '');
  // A legacy service role key is a JWT and is also sent as the bearer token; a new "sb_secret_..." key only goes in apikey.
  const headers: Record<string, string> = { apikey: options.serviceKey, 'Content-Type': 'application/json' };
  if (options.serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${options.serviceKey}`;

  async function send(path: string, init: { method: string; body?: unknown; prefer?: string }): Promise<void> {
    const res = await fetchImpl(`${base}/rest/v1/${path}`, {
      method: init.method,
      headers: init.prefer ? { ...headers, Prefer: init.prefer } : headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Supabase answered ${res.status} for ${init.method} ${path.split('?')[0]}`);
  }

  return {
    async apply(action) {
      if (action.kind === 'grant-ebook') {
        await send('ebook_purchases?on_conflict=user_id,slug', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: [{ user_id: action.userId, slug: action.slug, provider: 'dodo', provider_ref: action.ref }],
        });
      } else if (action.kind === 'revoke-ebook') {
        await send(`ebook_purchases?provider=eq.dodo&provider_ref=eq.${encodeURIComponent(action.ref)}`, { method: 'DELETE', prefer: 'return=minimal' });
      } else {
        await send(`profiles?id=eq.${action.userId}`, { method: 'PATCH', prefer: 'return=minimal', body: { tier: action.tier } });
      }
    },
  };
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
