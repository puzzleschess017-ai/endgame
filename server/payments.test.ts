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
const EBOOK_ID = '11111111-2222-4333-8444-555555555555';
const MONTHLY_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const YEARLY_ID = 'AAAAAAAA-BBBB-4CCC-8DDD-FFFFFFFFFFFF';
const PRODUCTS: Record<string, Product> = {
  [EBOOK_ID]: { kind: 'ebook', slug: 'queens-gambit' },
  [MONTHLY_ID]: { kind: 'premium' },
  [YEARLY_ID.toLowerCase()]: { kind: 'premium' },
};

describe('loadPaymentSettings', () => {
  const slugs = ['queens-gambit'];
  const settings = (env: Record<string, string>) => loadPaymentSettings(env, slugs, 'https://x.supabase.co');

  it('everything is off until the values are set', () => {
    assert.deepEqual(settings({}), { checkout: null, webhook: null });
    assert.deepEqual(settings({ POLAR_ACCESS_TOKEN: 't' }), { checkout: null, webhook: null });
    assert.deepEqual(settings({ POLAR_PRODUCT_EBOOK_QUEENS_GAMBIT: EBOOK_ID }), { checkout: null, webhook: null });
  });
  it('checkout needs a token and a product; the webhook needs the secret, the service key and a product', () => {
    const checkout = settings({ POLAR_ACCESS_TOKEN: 't', POLAR_PRODUCT_EBOOK_QUEENS_GAMBIT: EBOOK_ID });
    assert.deepEqual(checkout.checkout, { accessToken: 't', baseUrl: 'https://api.polar.sh', offers: { 'ebook:queens-gambit': EBOOK_ID } });
    assert.equal(checkout.webhook, null);
    const hook = settings({ POLAR_WEBHOOK_SECRET: 's', SUPABASE_SERVICE_ROLE_KEY: 'k', POLAR_PRODUCT_PREMIUM_MONTHLY: MONTHLY_ID });
    assert.equal(hook.checkout, null);
    assert.deepEqual(hook.webhook, { secret: 's', supabaseUrl: 'https://x.supabase.co', serviceKey: 'k', products: { [MONTHLY_ID]: { kind: 'premium' } } });
  });
  it('the sandbox is Polar’s test environment, and a product id that is not an id is ignored', () => {
    const s = settings({ POLAR_ACCESS_TOKEN: 't', POLAR_SERVER: ' Sandbox ', POLAR_PRODUCT_EBOOK_QUEENS_GAMBIT: 'not-an-id', POLAR_PRODUCT_PREMIUM_YEARLY: YEARLY_ID });
    assert.equal(s.checkout?.baseUrl, 'https://sandbox-api.polar.sh');
    assert.deepEqual(Object.keys(s.checkout?.offers ?? {}), ['premium:yearly']);
  });
  it('POLAR_API_URL points the checkout at a fake Polar (tests only), and only if it is a web address', () => {
    const base = { POLAR_ACCESS_TOKEN: 't', POLAR_PRODUCT_PREMIUM_MONTHLY: MONTHLY_ID };
    assert.equal(settings({ ...base, POLAR_API_URL: 'http://127.0.0.1:4666/' }).checkout?.baseUrl, 'http://127.0.0.1:4666');
    assert.equal(settings({ ...base, POLAR_API_URL: 'file:///etc/passwd' }).checkout?.baseUrl, 'https://api.polar.sh');
  });
});

describe('verifyWebhook', () => {
  const BODY = Buffer.from('{"type":"order.paid","data":{"id":"abc"}}');
  const NOW = 1_800_000_000;
  const KEY = crypto.randomBytes(24);
  const SECRET = `whsec_${KEY.toString('base64')}`;
  const sign = (key: Buffer, id: string, ts: number, body: Buffer) =>
    `v1,${crypto.createHmac('sha256', key).update(`${id}.${ts}.`).update(body).digest('base64')}`;
  const headers = (signature: string, ts = NOW) => ({ id: 'msg_1', timestamp: String(ts), signature });

  it('accepts a request signed with the secret', () => {
    assert.equal(verifyWebhook(SECRET, headers(sign(KEY, 'msg_1', NOW, BODY)), BODY, NOW), true);
  });
  it('accepts one good signature among several, and a secret made before 8 September 2026 (the whole text is the key)', () => {
    const several = `v1,AAAA ${sign(KEY, 'msg_1', NOW, BODY)} v2,zzzz`;
    assert.equal(verifyWebhook(SECRET, headers(several), BODY, NOW), true);
    const legacy = sign(Buffer.from(SECRET, 'utf8'), 'msg_1', NOW, BODY);
    assert.equal(verifyWebhook(SECRET, headers(legacy), BODY, NOW), true);
  });
  it('refuses a changed body, another id, another secret, and no signature at all', () => {
    const good = sign(KEY, 'msg_1', NOW, BODY);
    assert.equal(verifyWebhook(SECRET, headers(good), Buffer.from('{"type":"order.paid","data":{"id":"abd"}}'), NOW), false);
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

describe('actionFor', () => {
  const order = (type: string, extra: Record<string, unknown> = {}, product = EBOOK_ID) => ({
    type,
    data: { id: 'ord_1', product_id: product, billing_reason: 'purchase', metadata: { user_id: USER }, ...extra },
  });
  const sub = (type: string, extra: Record<string, unknown> = {}, product = MONTHLY_ID) => ({
    type,
    data: { id: 'sub_1', product_id: product, status: 'active', metadata: { user_id: USER }, ...extra },
  });

  it('a paid order of an e-book gives the book to the person named in the metadata', () => {
    assert.deepEqual(actionFor(order('order.paid'), PRODUCTS), { kind: 'grant-ebook', userId: USER, slug: 'queens-gambit', ref: 'ord_1' });
    // the product may come as an object, and the ids may be in capitals
    const nested = { type: 'order.paid', data: { id: 'ord_1', product: { id: EBOOK_ID.toUpperCase() }, metadata: { user_id: USER.toUpperCase() } } };
    assert.deepEqual(actionFor(nested, PRODUCTS), { kind: 'grant-ebook', userId: USER, slug: 'queens-gambit', ref: 'ord_1' });
  });
  it('a refunded order takes the book away again', () => {
    assert.deepEqual(actionFor(order('order.refunded'), PRODUCTS), { kind: 'revoke-ebook', ref: 'ord_1' });
  });
  it('an order that is not a one-time purchase, or has no known person, gives nothing', () => {
    assert.equal(actionFor(order('order.paid', { billing_reason: 'subscription_cycle' }), PRODUCTS), null);
    assert.equal(actionFor(order('order.paid', { metadata: {} }), PRODUCTS), null);
    assert.equal(actionFor(order('order.paid', { metadata: { user_id: 'x; drop table' } }), PRODUCTS), null);
    assert.equal(actionFor(order('order.paid', { id: 'a/../b' }), PRODUCTS), null);
    assert.equal(actionFor(order('order.created'), PRODUCTS), null);
    assert.equal(actionFor(order('order.paid', {}, '99999999-9999-4999-8999-999999999999'), PRODUCTS), null);
  });
  it('Premium: active, resumed and un-cancelled turn it on; a live update too', () => {
    const on = { kind: 'set-tier', userId: USER, tier: 'premium' };
    for (const type of ['subscription.active', 'subscription.uncanceled', 'subscription.resumed']) {
      assert.deepEqual(actionFor(sub(type), PRODUCTS), on, type);
    }
    assert.deepEqual(actionFor(sub('subscription.updated', { status: 'trialing' }), PRODUCTS), on);
    assert.deepEqual(actionFor(sub('subscription.created', {}, YEARLY_ID), PRODUCTS), on, 'the yearly product too');
  });
  it('Premium: ended or paused turns it off, a cancellation alone changes nothing', () => {
    const off = { kind: 'set-tier', userId: USER, tier: 'free' };
    assert.deepEqual(actionFor(sub('subscription.revoked', { status: 'canceled' }), PRODUCTS), off);
    assert.deepEqual(actionFor(sub('subscription.paused'), PRODUCTS), off);
    assert.equal(actionFor(sub('subscription.canceled', { cancel_at_period_end: true }), PRODUCTS), null);
    assert.equal(actionFor(sub('subscription.past_due', { status: 'past_due' }), PRODUCTS), null);
  });
  it('a late update of a subscription that has already ended does not turn Premium on again', () => {
    assert.equal(actionFor(sub('subscription.updated', { status: 'canceled' }), PRODUCTS), null);
    assert.equal(actionFor(sub('subscription.updated', { status: 'active', ended_at: '2026-12-01T00:00:00Z' }), PRODUCTS), null);
  });
  it('Premium events with no known person, and things that are not events, give nothing', () => {
    assert.equal(actionFor(sub('subscription.active', { metadata: {} }), PRODUCTS), null);
    for (const junk of [null, 5, 'x', [], {}, { type: 'order.paid' }, { type: 5, data: {} }]) assert.equal(actionFor(junk, PRODUCTS), null);
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
    await s.apply({ kind: 'grant-ebook', userId: USER, slug: 'queens-gambit', ref: 'ord_1' });
    assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/ebook_purchases?on_conflict=user_id,slug');
    assert.equal(calls[0].method, 'POST');
    assert.deepEqual(calls[0].body, [{ user_id: USER, slug: 'queens-gambit', provider: 'polar', provider_ref: 'ord_1' }]);
    assert.equal(calls[0].headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  });
  it('taking a book away deletes by the order, and the plan is a PATCH of one profile', async () => {
    const { calls, store: s } = store('eyJ.legacy.jwt');
    await s.apply({ kind: 'revoke-ebook', ref: 'ord_1' });
    await s.apply({ kind: 'set-tier', userId: USER, tier: 'premium' });
    assert.deepEqual([calls[0].method, calls[0].url], ['DELETE', 'https://x.supabase.co/rest/v1/ebook_purchases?provider=eq.polar&provider_ref=eq.ord_1']);
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
  it('throws when Supabase refuses, so that Polar delivers the event again', async () => {
    const { store: s } = store('k', 500);
    await assert.rejects(() => s.apply({ kind: 'set-tier', userId: USER, tier: 'free' }), /500/);
  });
});

describe('createCheckout', () => {
  const config: CheckoutConfig = { accessToken: 'polar_oat_x', baseUrl: 'https://api.polar.sh', offers: {} };
  const request = { config, productId: EBOOK_ID, userId: USER, email: 'ana@example.com', successUrl: 'https://s.example/ebooks?purchase=success', returnUrl: 'https://s.example/ebooks' };

  it('asks Polar for a checkout with the person’s id in the metadata and gives back its address', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return Response.json({ url: 'https://polar.sh/checkout/abc' }, { status: 201 });
    }) as unknown as typeof fetch;
    assert.equal(await createCheckout({ ...request, ipAddress: '203.0.113.9', fetchImpl }), 'https://polar.sh/checkout/abc');
    assert.equal(seen!.url, 'https://api.polar.sh/v1/checkouts/');
    assert.equal((seen!.init.headers as Record<string, string>).Authorization, 'Bearer polar_oat_x');
    assert.deepEqual(JSON.parse(String(seen!.init.body)), {
      products: [EBOOK_ID],
      external_customer_id: USER,
      customer_email: 'ana@example.com',
      customer_ip_address: '203.0.113.9',
      metadata: { user_id: USER },
      success_url: 'https://s.example/ebooks?purchase=success',
      return_url: 'https://s.example/ebooks',
    });
  });
  it('throws when Polar refuses or gives no https address', async () => {
    const refuse = (async () => new Response('{}', { status: 422 })) as unknown as typeof fetch;
    await assert.rejects(() => createCheckout({ ...request, fetchImpl: refuse }), /422/);
    for (const body of [{}, { url: 5 }, { url: 'http://insecure.example' }, { url: 'javascript:alert(1)' }]) {
      const odd = (async () => Response.json(body, { status: 201 })) as unknown as typeof fetch;
      await assert.rejects(() => createCheckout({ ...request, fetchImpl: odd }), /no checkout address/);
    }
  });
});
