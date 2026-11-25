import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import {
  actionFor,
  createCheckout,
  createPaymentStore,
  loadPaymentSettings,
  verifyWebhook,
  type CheckoutConfig,
  type Product,
} from './payments.ts';

const USER = '3f8c2d5e-1a4b-4c6d-8e9f-0a1b2c3d4e5f';
const EBOOK_ID = 'pdt_0NdBookQueensGambit1';
const MONTHLY_ID = 'pdt_0NdPremiumMonthly22';
const YEARLY_ID = 'pdt_0NdPremiumYearly333';
const PRODUCTS: Record<string, Product> = {
  [EBOOK_ID]: { kind: 'ebook', slug: 'queens-gambit' },
  [MONTHLY_ID]: { kind: 'premium' },
  [YEARLY_ID]: { kind: 'premium' },
};

describe('loadPaymentSettings', () => {
  const slugs = ['queens-gambit'];
  const settings = (env: Record<string, string>) => loadPaymentSettings(env, slugs, 'https://x.supabase.co');

  it('everything is off until the values are set', () => {
    assert.deepEqual(settings({}), { checkout: null, webhook: null });
    assert.deepEqual(settings({ DODO_PAYMENTS_API_KEY: 'k' }), { checkout: null, webhook: null });
    assert.deepEqual(settings({ DODO_PAYMENTS_PRODUCT_EBOOK_QUEENS_GAMBIT: EBOOK_ID }), { checkout: null, webhook: null });
  });
  it('checkout needs a key and a product; the webhook needs the secret, the service key and a product', () => {
    const checkout = settings({ DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_PRODUCT_EBOOK_QUEENS_GAMBIT: EBOOK_ID });
    assert.deepEqual(checkout.checkout, { apiKey: 'k', baseUrl: 'https://live.dodopayments.com', offers: { 'ebook:queens-gambit': EBOOK_ID } });
    assert.equal(checkout.webhook, null);
    const hook = settings({ DODO_PAYMENTS_WEBHOOK_KEY: 's', SUPABASE_SERVICE_ROLE_KEY: 'k', DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY: MONTHLY_ID });
    assert.equal(hook.checkout, null);
    assert.deepEqual(hook.webhook, { secret: 's', supabaseUrl: 'https://x.supabase.co', serviceKey: 'k', products: { [MONTHLY_ID]: { kind: 'premium' } } });
  });
  it('test mode is Dodo’s test environment: asked for, or seen from a dodo_test_ key; a product id that is not an id is ignored', () => {
    const base = { DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY: YEARLY_ID };
    const asked = settings({ ...base, DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_ENVIRONMENT: ' Test_Mode ', DODO_PAYMENTS_PRODUCT_EBOOK_QUEENS_GAMBIT: 'no id!' });
    assert.equal(asked.checkout?.baseUrl, 'https://test.dodopayments.com');
    assert.deepEqual(Object.keys(asked.checkout?.offers ?? {}), ['premium:yearly']);
    assert.equal(settings({ ...base, DODO_PAYMENTS_API_KEY: 'dodo_test_abc' }).checkout?.baseUrl, 'https://test.dodopayments.com');
    assert.equal(settings({ ...base, DODO_PAYMENTS_API_KEY: 'dodo_live_abc' }).checkout?.baseUrl, 'https://live.dodopayments.com');
    // an explicit setting wins over the key
    assert.equal(settings({ ...base, DODO_PAYMENTS_API_KEY: 'dodo_test_abc', DODO_PAYMENTS_ENVIRONMENT: 'live_mode' }).checkout?.baseUrl, 'https://live.dodopayments.com');
  });
  it('DODO_PAYMENTS_API_URL points the checkout at a fake Dodo (tests only), and only if it is a web address', () => {
    const base = { DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY: MONTHLY_ID };
    assert.equal(settings({ ...base, DODO_PAYMENTS_API_URL: 'http://127.0.0.1:4666/' }).checkout?.baseUrl, 'http://127.0.0.1:4666');
    assert.equal(settings({ ...base, DODO_PAYMENTS_API_URL: 'file:///etc/passwd' }).checkout?.baseUrl, 'https://live.dodopayments.com');
  });
});

describe('verifyWebhook', () => {
  const BODY = Buffer.from('{"type":"payment.succeeded","data":{"payment_id":"pay_abc"}}');
  const NOW = 1_800_000_000;
  const KEY = crypto.randomBytes(24);
  const SECRET = `whsec_${KEY.toString('base64')}`;
  const sign = (key: Buffer, id: string, ts: number, body: Buffer) =>
    `v1,${crypto.createHmac('sha256', key).update(`${id}.${ts}.`).update(body).digest('base64')}`;
  const headers = (signature: string, ts = NOW) => ({ id: 'msg_1', timestamp: String(ts), signature });

  it('accepts a request signed with the secret, with or without the whsec_ prefix', () => {
    assert.equal(verifyWebhook(SECRET, headers(sign(KEY, 'msg_1', NOW, BODY)), BODY, NOW), true);
    assert.equal(verifyWebhook(KEY.toString('base64'), headers(sign(KEY, 'msg_1', NOW, BODY)), BODY, NOW), true);
  });
  it('accepts one good signature among several', () => {
    const several = `v1,AAAA ${sign(KEY, 'msg_1', NOW, BODY)} v2,zzzz`;
    assert.equal(verifyWebhook(SECRET, headers(several), BODY, NOW), true);
  });
  it('refuses a changed body, another id, another secret, and no signature at all', () => {
    const good = sign(KEY, 'msg_1', NOW, BODY);
    assert.equal(verifyWebhook(SECRET, headers(good), Buffer.from('{"type":"payment.succeeded","data":{"payment_id":"pay_abd"}}'), NOW), false);
    assert.equal(verifyWebhook(SECRET, { ...headers(good), id: 'msg_2' }, BODY, NOW), false);
    assert.equal(verifyWebhook(`whsec_${crypto.randomBytes(24).toString('base64')}`, headers(good), BODY, NOW), false);
    for (const bad of ['', 'v1,', 'v2,abc', 'garbage', undefined]) {
      assert.equal(verifyWebhook(SECRET, { id: 'msg_1', timestamp: String(NOW), signature: bad }, BODY, NOW), false, String(bad));
    }
    assert.equal(verifyWebhook(SECRET, { id: undefined, timestamp: String(NOW), signature: good }, BODY, NOW), false);
    assert.equal(verifyWebhook('', headers(good), BODY, NOW), false);
  });
  it('refuses a request that is more than five minutes old or from the future (a replay)', () => {
    const old = NOW - 301;
    assert.equal(verifyWebhook(SECRET, headers(sign(KEY, 'msg_1', old, BODY), old), BODY, NOW), false);
    const future = NOW + 301;
    assert.equal(verifyWebhook(SECRET, headers(sign(KEY, 'msg_1', future, BODY), future), BODY, NOW), false);
    const edge = NOW - 300;
    assert.equal(verifyWebhook(SECRET, headers(sign(KEY, 'msg_1', edge, BODY), edge), BODY, NOW), true);
    assert.equal(verifyWebhook(SECRET, { id: 'msg_1', timestamp: 'abc', signature: sign(KEY, 'msg_1', NOW, BODY) }, BODY, NOW), false);
  });
});

// The shapes follow Dodo's webhook types (the "dodopayments" SDK): { business_id, timestamp, type, data }, where data is the
// payment, the refund or the subscription as it is at the time of delivery.
describe('actionFor', () => {
  const payment = (extra: Record<string, unknown> = {}, product = EBOOK_ID, type = 'payment.succeeded') => ({
    business_id: 'bus_1',
    timestamp: '2026-12-01T10:00:00Z',
    type,
    data: {
      payload_type: 'Payment',
      payment_id: 'pay_1',
      status: 'succeeded',
      product_cart: [{ product_id: product, quantity: 1 }],
      metadata: { user_id: USER, offer: 'ebook:queens-gambit' },
      ...extra,
    },
  });
  const premiumPayment = (extra: Record<string, unknown> = {}, product = MONTHLY_ID) =>
    payment({ subscription_id: 'sub_1', metadata: { user_id: USER, offer: 'premium:monthly' }, ...extra }, product);
  const refund = (extra: Record<string, unknown> = {}, type = 'refund.succeeded') => ({
    type,
    data: { payload_type: 'Refund', refund_id: 'ref_1', payment_id: 'pay_1', status: 'succeeded', is_partial: false, metadata: {}, ...extra },
  });
  const sub = (status: string, extra: Record<string, unknown> = {}, product = MONTHLY_ID, type = 'subscription.active') => ({
    type,
    data: { payload_type: 'Subscription', subscription_id: 'sub_1', product_id: product, status, metadata: { user_id: USER }, ...extra },
  });
  const on = { kind: 'set-tier', userId: USER, tier: 'premium' };
  const off = { kind: 'set-tier', userId: USER, tier: 'free' };

  it('a paid e-book gives the book to the person named in the metadata', () => {
    assert.deepEqual(actionFor(payment(), PRODUCTS), { kind: 'grant-ebook', userId: USER, slug: 'queens-gambit', ref: 'pay_1' });
    // the id in capitals is still the same person
    const capitals = payment({ metadata: { user_id: USER.toUpperCase() } });
    assert.deepEqual(actionFor(capitals, PRODUCTS), { kind: 'grant-ebook', userId: USER, slug: 'queens-gambit', ref: 'pay_1' });
  });
  it('a payment that is not an e-book of this site, has no known person, or did not succeed gives nothing', () => {
    assert.equal(actionFor(payment({ metadata: {} }), PRODUCTS), null);
    assert.equal(actionFor(payment({ metadata: { user_id: 'x; drop table' } }), PRODUCTS), null);
    assert.equal(actionFor(payment({ payment_id: 'a/../b' }), PRODUCTS), null);
    assert.equal(actionFor(payment({ payment_id: undefined }), PRODUCTS), null);
    assert.equal(actionFor(payment({ status: 'failed' }), PRODUCTS), null);
    assert.equal(actionFor(payment({}, 'pdt_unknown_product_9'), PRODUCTS), null);
    assert.equal(actionFor(payment({ product_cart: null }), PRODUCTS), null);
    assert.equal(actionFor(payment({}, EBOOK_ID, 'payment.failed'), PRODUCTS), null);
    assert.equal(actionFor(payment({}, EBOOK_ID, 'payment.processing'), PRODUCTS), null);
  });
  it('a full refund takes the e-book away again; a partial or failed refund does not', () => {
    assert.deepEqual(actionFor(refund(), PRODUCTS), { kind: 'revoke-ebook', ref: 'pay_1' });
    assert.equal(actionFor(refund({ is_partial: true }), PRODUCTS), null);
    assert.equal(actionFor(refund({ status: 'failed' }, 'refund.failed'), PRODUCTS), null);
    assert.equal(actionFor(refund({ payment_id: 'a b' }), PRODUCTS), null);
  });
  it('the first payment of a Premium subscription, and each renewal, turn Premium on', () => {
    assert.deepEqual(actionFor(premiumPayment(), PRODUCTS), on);
    assert.deepEqual(actionFor(premiumPayment({}, YEARLY_ID), PRODUCTS), on, 'the yearly product too');
    assert.deepEqual(actionFor(premiumPayment({ subscription_id: undefined, subscription_ids: ['sub_1'] }), PRODUCTS), on);
    // a one-time payment of a Premium product that is not part of a subscription is not Premium
    assert.equal(actionFor(payment({}, MONTHLY_ID), PRODUCTS), null);
  });
  it('Premium follows the status of the subscription: active is on, on hold, cancelled, expired and paused are off', () => {
    assert.deepEqual(actionFor(sub('active'), PRODUCTS), on);
    assert.deepEqual(actionFor(sub('active', {}, YEARLY_ID, 'subscription.renewed'), PRODUCTS), on);
    assert.deepEqual(actionFor(sub('active', { cancel_at_next_billing_date: true }, MONTHLY_ID, 'subscription.updated'), PRODUCTS), on, 'cancelled for the end of the paid period: still Premium');
    for (const status of ['on_hold', 'cancelled', 'expired', 'paused']) {
      assert.deepEqual(actionFor(sub(status, {}, MONTHLY_ID, `subscription.${status}`), PRODUCTS), off, status);
    }
  });
  it('a late event of an old state cannot bring Premium back, because the status is the latest one', () => {
    assert.deepEqual(actionFor(sub('expired', {}, MONTHLY_ID, 'subscription.active'), PRODUCTS), off);
    assert.deepEqual(actionFor(sub('cancelled', {}, MONTHLY_ID, 'subscription.updated'), PRODUCTS), off);
  });
  it('past due, pending and failed subscriptions change nothing', () => {
    for (const status of ['past_due', 'pending', 'failed', 'something_new']) {
      assert.equal(actionFor(sub(status), PRODUCTS), null, status);
    }
  });
  it('Premium events with no known person or product, and things that are not events, give nothing', () => {
    assert.equal(actionFor(sub('active', { metadata: {} }), PRODUCTS), null);
    assert.equal(actionFor(sub('active', {}, 'pdt_unknown_product_9'), PRODUCTS), null);
    assert.equal(actionFor(sub('active', {}, EBOOK_ID), PRODUCTS), null, 'an e-book is not a subscription');
    for (const junk of [null, 5, 'x', [], {}, { type: 'payment.succeeded' }, { type: 5, data: {} }, { type: 'dispute.opened', data: {} }]) {
      assert.equal(actionFor(junk, PRODUCTS), null);
    }
  });
});

describe('createPaymentStore', () => {
  function store(serviceKey: string, status = 200) {
    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(null, { status });
    }) as typeof fetch;
    return { calls, store: createPaymentStore({ url: 'https://x.supabase.co/', serviceKey, fetchImpl }) };
  }

  it('giving a book is an upsert of one row, so a repeated webhook changes nothing', async () => {
    const { calls, store: s } = store('eyJ.legacy.jwt');
    await s.apply({ kind: 'grant-ebook', userId: USER, slug: 'queens-gambit', ref: 'pay_1' });
    assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/ebook_purchases?on_conflict=user_id,slug');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, [{ user_id: USER, slug: 'queens-gambit', provider: 'dodo', provider_ref: 'pay_1' }]);
    assert.equal(calls[0].headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  });
  it('taking a book away deletes by the payment, and the plan is a PATCH of one profile', async () => {
    const { calls, store: s } = store('eyJ.legacy.jwt');
    await s.apply({ kind: 'revoke-ebook', ref: 'pay_1' });
    await s.apply({ kind: 'set-tier', userId: USER, tier: 'premium' });
    assert.deepEqual([calls[0].method, calls[0].url], ['DELETE', 'https://x.supabase.co/rest/v1/ebook_purchases?provider=eq.dodo&provider_ref=eq.pay_1']);
    assert.deepEqual([calls[1].method, calls[1].url, calls[1].body], ['PATCH', `https://x.supabase.co/rest/v1/profiles?id=eq.${USER}`, { tier: 'premium' }]);
  });
  it('a legacy key (a JWT) is also the bearer token; a new sb_secret key goes in apikey only', async () => {
    const legacy = store('eyJ.legacy.jwt');
    await legacy.store.apply({ kind: 'revoke-ebook', ref: 'o' });
    assert.equal(legacy.calls[0].headers.apikey, 'eyJ.legacy.jwt');
    assert.equal(legacy.calls[0].headers.Authorization, 'Bearer eyJ.legacy.jwt');
    const modern = store('sb_secret_abc');
    await modern.store.apply({ kind: 'revoke-ebook', ref: 'o' });
    assert.equal(modern.calls[0].headers.apikey, 'sb_secret_abc');
    assert.equal(modern.calls[0].headers.Authorization, undefined);
  });
  it('throws when Supabase refuses, so that Dodo delivers the event again', async () => {
    const { store: s } = store('k', 500);
    await assert.rejects(() => s.apply({ kind: 'set-tier', userId: USER, tier: 'free' }), /500/);
  });
});

describe('createCheckout', () => {
  const config: CheckoutConfig = { apiKey: 'dodo_test_x', baseUrl: 'https://test.dodopayments.com', offers: {} };
  const request = {
    config,
    offer: 'ebook:queens-gambit',
    productId: EBOOK_ID,
    userId: USER,
    email: 'ana@example.com',
    returnUrl: 'https://s.example/ebooks?purchase=book',
    cancelUrl: 'https://s.example/ebooks',
  };

  it('asks Dodo for a checkout session with the person’s id in the metadata and gives back its address', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return Response.json({ session_id: 'cks_1', checkout_url: 'https://checkout.dodopayments.com/session/cks_1' });
    }) as unknown as typeof fetch;
    assert.equal(await createCheckout({ ...request, fetchImpl }), 'https://checkout.dodopayments.com/session/cks_1');
    assert.equal(seen!.url, 'https://test.dodopayments.com/checkouts');
    assert.equal((seen!.init.headers as Record<string, string>).Authorization, 'Bearer dodo_test_x');
    assert.deepEqual(JSON.parse(String(seen!.init.body)), {
      product_cart: [{ product_id: EBOOK_ID, quantity: 1 }],
      customer: { email: 'ana@example.com' },
      metadata: { user_id: USER, offer: 'ebook:queens-gambit' },
      return_url: 'https://s.example/ebooks?purchase=book',
      cancel_url: 'https://s.example/ebooks',
    });
  });
  it('without an email the customer is left out (Dodo asks for it on its page)', async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return Response.json({ checkout_url: 'https://checkout.dodopayments.com/session/cks_2' });
    }) as unknown as typeof fetch;
    await createCheckout({ ...request, email: undefined, fetchImpl });
    assert.equal('customer' in body, false);
  });
  it('throws when Dodo refuses or gives no https address', async () => {
    const refuse = (async () => new Response('{}', { status: 422 })) as unknown as typeof fetch;
    await assert.rejects(() => createCheckout({ ...request, fetchImpl: refuse }), /422/);
    for (const body of [{}, { checkout_url: null }, { checkout_url: 5 }, { checkout_url: 'http://insecure.example' }, { checkout_url: 'javascript:alert(1)' }]) {
      const odd = (async () => Response.json(body)) as unknown as typeof fetch;
      await assert.rejects(() => createCheckout({ ...request, fetchImpl: odd }), /no checkout address/);
    }
  });
});
