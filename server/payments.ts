// Payments through Polar (https://polar.sh), a merchant of record: Polar is the seller, collects the card payment,
// handles VAT and sales tax, and pays the money out. One provider sells both things of this site:
//   - an e-book (a one-time product): the webhook writes a row to ebook_purchases,
//   - Premium (a monthly or yearly subscription): the webhook sets the plan in profiles.tier.
// The flow: the page asks POST /api/checkout, the server asks Polar for a checkout with the signed-in person's id in
// the metadata, the person pays on Polar's page, and Polar calls POST /api/webhooks/polar. Everything here is
// switched off until the environment variables below are set (see .env.example).
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------------------------
// What is for sale
// ---------------------------------------------------------------------------------------------

/** What a Polar product is: one e-book, or Premium (the monthly and the yearly product are both Premium). */
export type Product = { kind: 'ebook'; slug: string } | { kind: 'premium' };

/** The things the page may ask to buy: `ebook:<slug>`, `premium:monthly`, `premium:yearly`. */
export type Offer = `ebook:${string}` | 'premium:monthly' | 'premium:yearly';

const PRODUCT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface CheckoutConfig {
  accessToken: string;
  /** https://api.polar.sh, or https://sandbox-api.polar.sh for testing. */
  baseUrl: string;
  /** Offer → Polar product id. */
  offers: Record<string, string>;
}

export interface WebhookConfig {
  secret: string;
  supabaseUrl: string;
  /** The Supabase service role key (a secret: it can write to any row). */
  serviceKey: string;
  /** Polar product id → what it is. */
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

/** Polar's address: the real one, the sandbox (POLAR_SERVER=sandbox), or POLAR_API_URL (only for tests with a fake Polar). */
function polarBaseUrl(env: Env): string {
  const custom = clean(env.POLAR_API_URL).replace(/\/+$/, '');
  if (/^https?:\/\//.test(custom)) return custom;
  return clean(env.POLAR_SERVER).toLowerCase() === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
}

/**
 * Reads the settings. Each half is on only when all of its values are there:
 *   checkout: POLAR_ACCESS_TOKEN and at least one product id
 *   webhook:  POLAR_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY and at least one product id
 * Product ids: POLAR_PRODUCT_EBOOK_<SLUG> (the slug in capitals, - as _), POLAR_PRODUCT_PREMIUM_MONTHLY, POLAR_PRODUCT_PREMIUM_YEARLY.
 * POLAR_SERVER=sandbox uses Polar's test environment.
 */
export function loadPaymentSettings(env: Env, ebookSlugs: string[], supabaseUrl: string): PaymentSettings {
  const offers: Record<string, string> = {};
  const products: Record<string, Product> = {};
  const add = (offer: Offer, product: Product, id: string | undefined) => {
    const value = clean(id);
    if (!PRODUCT_ID.test(value)) return;
    offers[offer] = value;
    products[value.toLowerCase()] = product;
  };
  for (const slug of ebookSlugs) {
    add(`ebook:${slug}`, { kind: 'ebook', slug }, env[`POLAR_PRODUCT_EBOOK_${slug.toUpperCase().replace(/-/g, '_')}`]);
  }
  add('premium:monthly', { kind: 'premium' }, env.POLAR_PRODUCT_PREMIUM_MONTHLY);
  add('premium:yearly', { kind: 'premium' }, env.POLAR_PRODUCT_PREMIUM_YEARLY);

  const hasProducts = Object.keys(offers).length > 0;
  const token = clean(env.POLAR_ACCESS_TOKEN);
  const secret = clean(env.POLAR_WEBHOOK_SECRET);
  const serviceKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    checkout:
      hasProducts && token
        ? { accessToken: token, baseUrl: polarBaseUrl(env), offers }
        : null,
    webhook: hasProducts && secret && serviceKey ? { secret, supabaseUrl, serviceKey, products } : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Checking that a webhook really comes from Polar (the Standard Webhooks signature)
// ---------------------------------------------------------------------------------------------

export interface WebhookHeaders {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
}

/**
 * True when the request is signed with the secret. The signature is HMAC-SHA256 over "<id>.<timestamp>.<body>", in base64,
 * sent as "v1,<signature>" (several, separated by spaces, are allowed). A request older or newer than five minutes is refused.
 * Polar's secrets made before 8 September 2026 use the UTF-8 bytes of the whole "whsec_..." text as the key, newer ones the
 * base64 part after "whsec_": both keys are tried, as Polar's own SDKs do.
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

  const keys = [Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64'), Buffer.from(secret, 'utf8')];
  const signed = Buffer.concat([Buffer.from(`${id}.${timestamp}.`, 'utf8'), body]);
  const given = signature
    .split(' ')
    .map((part) => /^v1,(.+)$/.exec(part)?.[1])
    .filter((part): part is string => typeof part === 'string')
    .map((part) => Buffer.from(part, 'base64'));
  if (given.length === 0) return false;

  return keys.some((key) => {
    if (key.length === 0) return false;
    const expected = crypto.createHmac('sha256', key).update(signed).digest();
    return given.some((candidate) => candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected));
  });
}

// ---------------------------------------------------------------------------------------------
// From a Polar event to what has to change on the site
// ---------------------------------------------------------------------------------------------

export type PaymentAction =
  | { kind: 'grant-ebook'; userId: string; slug: string; ref: string }
  | { kind: 'revoke-ebook'; ref: string }
  | { kind: 'set-tier'; userId: string; tier: 'free' | 'premium' };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * What an event means for the site, or null when there is nothing to do (an event of no interest, or one that is not
 * about a product of this site). The person is found by the user_id the server put in the checkout's metadata, which Polar
 * copies to the order and the subscription.
 *   order.paid        a one-time purchase of an e-book: the person owns it
 *   order.refunded    an e-book is refunded: the person no longer owns it
 *   subscription.*    Premium: active, resumed or un-cancelled turn it on; revoked (ended) or paused turn it off.
 *                     A cancellation alone changes nothing: Premium lasts until the paid period ends, and then comes "revoked".
 */
export function actionFor(event: unknown, products: Record<string, Product>): PaymentAction | null {
  const root = record(event);
  const data = record(root?.data);
  if (!root || !data || typeof root.type !== 'string') return null;

  const productId = typeof data.product_id === 'string' ? data.product_id : record(data.product)?.id;
  const product = typeof productId === 'string' ? products[productId.toLowerCase()] : undefined;
  if (!product) return null;

  const rawUser = record(data.metadata)?.user_id;
  const userId = typeof rawUser === 'string' && USER_ID.test(rawUser) ? rawUser.toLowerCase() : null;
  const orderId = typeof data.id === 'string' && ORDER_ID.test(data.id) ? data.id : null;
  const type = root.type;

  if (product.kind === 'ebook') {
    if (type === 'order.paid') {
      const reason = data.billing_reason;
      if (!userId || !orderId || (reason !== undefined && reason !== 'purchase')) return null;
      return { kind: 'grant-ebook', userId, slug: product.slug, ref: orderId };
    }
    if (type === 'order.refunded' && orderId) return { kind: 'revoke-ebook', ref: orderId };
    return null;
  }

  if (!type.startsWith('subscription.') || !userId) return null;
  if (type === 'subscription.active' || type === 'subscription.uncanceled' || type === 'subscription.resumed') {
    return { kind: 'set-tier', userId, tier: 'premium' };
  }
  if (type === 'subscription.created' || type === 'subscription.updated') {
    // An update that arrives late, after the subscription has ended, must not turn Premium on again.
    const live = (data.status === 'active' || data.status === 'trialing') && !data.ended_at;
    return live ? { kind: 'set-tier', userId, tier: 'premium' } : null;
  }
  if (type === 'subscription.revoked' || type === 'subscription.paused') return { kind: 'set-tier', userId, tier: 'free' };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Writing the result to Supabase (with the service role key: the person cannot do this from the page)
// ---------------------------------------------------------------------------------------------

export interface PaymentStore {
  /** Applies an action. Throws when Supabase refuses, so the webhook answers with an error and Polar tries again. */
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
          body: [{ user_id: action.userId, slug: action.slug, provider: 'polar', provider_ref: action.ref }],
        });
      } else if (action.kind === 'revoke-ebook') {
        await send(`ebook_purchases?provider=eq.polar&provider_ref=eq.${encodeURIComponent(action.ref)}`, { method: 'DELETE', prefer: 'return=minimal' });
      } else {
        await send(`profiles?id=eq.${action.userId}`, { method: 'PATCH', prefer: 'return=minimal', body: { tier: action.tier } });
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Asking Polar for a checkout
// ---------------------------------------------------------------------------------------------

export interface CheckoutRequest {
  config: CheckoutConfig;
  productId: string;
  userId: string;
  email?: string;
  /** Where Polar sends the person after paying. */
  successUrl: string;
  /** Where the "back" button of the checkout goes. */
  returnUrl: string;
  /** The person's IP, so Polar picks the right country and currency. */
  ipAddress?: string;
  fetchImpl?: typeof fetch;
}

/** Makes a checkout for one product and returns the address of its page. Throws when Polar does not give one. */
export async function createCheckout(request: CheckoutRequest): Promise<string> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const res = await fetchImpl(`${request.config.baseUrl}/v1/checkouts/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${request.config.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      products: [request.productId],
      external_customer_id: request.userId,
      ...(request.email ? { customer_email: request.email } : {}),
      ...(request.ipAddress ? { customer_ip_address: request.ipAddress } : {}),
      metadata: { user_id: request.userId },
      success_url: request.successUrl,
      return_url: request.returnUrl,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Polar answered ${res.status} when making a checkout`);
  const url = ((await res.json()) as { url?: unknown }).url;
  if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Polar gave no checkout address');
  return url;
}
