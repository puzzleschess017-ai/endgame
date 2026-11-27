import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import {
  actionFor,
  cancelSubscription,
  cancelUserSubscription,
  createCheckout,
  createPaymentStore,
  fetchSubscription,
  loadPaymentSettings,
  NO_SUBSCRIPTION,
  subscriptionOf,
  subscriptionView,
  verifyWebhook,
  type CheckoutConfig,
  type DodoApi,
  type PaymentStore,
} from './payments.ts';

const USER = '3f8c2d5e-1a4b-4c6d-8e9f-0a1b2c3d4e5f';
const MONTHLY_ID = 'pdt_0NdPremiumMonthly22';
const YEARLY_ID = 'pdt_0NdPremiumYearly333';
const OTHER_ID = 'pdt_0NdSomethingElse444';
const PRODUCTS = [MONTHLY_ID, YEARLY_ID];

describe('loadPaymentSettings', () => {
  const settings = (env: Record<string, string>) => loadPaymentSettings(env, 'https://x.supabase.co');

  it('everything is off until the values are set', () => {
    assert.deepEqual(settings({}), { checkout: null, webhook: null });
    assert.deepEqual(settings({ DODO_PAYMENTS_API_KEY: 'k' }), { checkout: null, webhook: null });
    assert.deepEqual(settings({ DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY: MONTHLY_ID }), { checkout: null, webhook: null });
    // the e-books are not for sale any more: a leftover product id of one is not read
    assert.deepEqual(settings({ DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_PRODUCT_EBOOK_QUEENS_GAMBIT: OTHER_ID }), { checkout: null, webhook: null });
  });
  it('checkout needs a key and a product; the webhook needs the secret, the service key and a product', () => {
    const checkout = settings({ DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY: MONTHLY_ID, DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY: YEARLY_ID });
    assert.deepEqual(checkout.checkout, {
      apiKey: 'k',
      baseUrl: 'https://live.dodopayments.com',
      offers: { 'premium:monthly': MONTHLY_ID, 'premium:yearly': YEARLY_ID },
    });
    assert.equal(checkout.webhook, null);
    const hook = settings({ DODO_PAYMENTS_WEBHOOK_KEY: 's', SUPABASE_SERVICE_ROLE_KEY: 'k', DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY: MONTHLY_ID });
    assert.equal(hook.checkout, null);
    assert.deepEqual(hook.webhook, { secret: 's', supabaseUrl: 'https://x.supabase.co', serviceKey: 'k', premiumProducts: [MONTHLY_ID] });
  });
  it('one plan can be left out: the other one still works', () => {
    const yearlyOnly = settings({ DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY: YEARLY_ID });
    assert.deepEqual(Object.keys(yearlyOnly.checkout?.offers ?? {}), ['premium:yearly']);
  });
  it('test mode is Dodo’s test environment: asked for, or seen from a dodo_test_ key; a product id that is not an id is ignored', () => {
    const base = { DODO_PAYMENTS_PRODUCT_PREMIUM_YEARLY: YEARLY_ID };
    const asked = settings({ ...base, DODO_PAYMENTS_API_KEY: 'k', DODO_PAYMENTS_ENVIRONMENT: ' Test_Mode ', DODO_PAYMENTS_PRODUCT_PREMIUM_MONTHLY: 'no id!' });
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
// payment or the subscription as it is at the time of delivery.
describe('actionFor', () => {
  const payment = (extra: Record<string, unknown> = {}, product = MONTHLY_ID, type = 'payment.succeeded') => ({
    business_id: 'bus_1',
    timestamp: '2026-12-01T10:00:00Z',
    type,
    data: {
      payload_type: 'Payment',
      payment_id: 'pay_1',
      status: 'succeeded',
      subscription_id: 'sub_1',
      product_cart: [{ product_id: product, quantity: 1 }],
      metadata: { user_id: USER, offer: 'premium:monthly' },
      ...extra,
    },
  });
  const sub = (status: string, extra: Record<string, unknown> = {}, product = MONTHLY_ID, type = 'subscription.active') => ({
    type,
    data: { payload_type: 'Subscription', subscription_id: 'sub_1', product_id: product, status, metadata: { user_id: USER }, ...extra },
  });
  const on = { kind: 'set-tier', userId: USER, tier: 'premium', subscriptionId: 'sub_1' };
  const off = { kind: 'set-tier', userId: USER, tier: 'free' };

  it('the first payment of a Premium subscription, and each renewal, turn Premium on', () => {
    assert.deepEqual(actionFor(payment(), PRODUCTS), on);
    assert.deepEqual(actionFor(payment({}, YEARLY_ID), PRODUCTS), on, 'the yearly product too');
    assert.deepEqual(actionFor(payment({ subscription_id: undefined, subscription_ids: ['sub_1'] }), PRODUCTS), on);
    // the id in capitals is still the same person
    assert.deepEqual(actionFor(payment({ metadata: { user_id: USER.toUpperCase() } }), PRODUCTS), on);
  });
  it('a Premium event carries the id of its subscription, so that the person can cancel it later', () => {
    assert.equal((actionFor(payment(), PRODUCTS) as { subscriptionId?: string }).subscriptionId, 'sub_1');
    assert.equal((actionFor(sub('active', { subscription_id: 'sub_2' }), PRODUCTS) as { subscriptionId?: string }).subscriptionId, 'sub_2');
    // an id that is not an id is not saved, but Premium still turns on
    const odd = actionFor(sub('active', { subscription_id: '../../x' }), PRODUCTS);
    assert.deepEqual(odd, { kind: 'set-tier', userId: USER, tier: 'premium' });
    // the end of a subscription carries no id: the one that was saved stays
    assert.deepEqual(actionFor(sub('cancelled', {}, MONTHLY_ID, 'subscription.cancelled'), PRODUCTS), off);
  });
  it('Dodo sends product_cart as null for a checkout session: the offer in the metadata says it is Premium', () => {
    assert.deepEqual(actionFor(payment({ product_cart: null }), PRODUCTS), on);
    assert.deepEqual(actionFor(payment({ product_cart: null, metadata: { user_id: USER, offer: 'premium:yearly' } }), PRODUCTS), on);
    assert.equal(actionFor(payment({ product_cart: null, subscription_id: undefined }), PRODUCTS), null, 'a one-time payment is still not Premium');
    assert.equal(actionFor(payment({ product_cart: null }), []), null, 'nothing to do when no Premium product is set up');
  });
  it('a one-time payment, even of a Premium product, is not Premium', () => {
    assert.equal(actionFor(payment({ subscription_id: undefined }), PRODUCTS), null);
  });
  it('a payment that is not of this site, has no known person, or did not succeed gives nothing', () => {
    assert.equal(actionFor(payment({ metadata: {} }), PRODUCTS), null);
    assert.equal(actionFor(payment({ metadata: { user_id: 'x; drop table' } }), PRODUCTS), null);
    assert.equal(actionFor(payment({ payment_id: 'a/../b' }), PRODUCTS), null);
    assert.equal(actionFor(payment({ payment_id: undefined }), PRODUCTS), null);
    assert.equal(actionFor(payment({ status: 'failed' }), PRODUCTS), null);
    assert.equal(actionFor(payment({}, OTHER_ID), PRODUCTS), null);
    assert.equal(actionFor(payment({ product_cart: null, metadata: { user_id: USER } }), PRODUCTS), null, 'no cart and no offer of this site');
    assert.equal(actionFor(payment({ product_cart: null, metadata: { user_id: USER, offer: 'other:thing' } }), PRODUCTS), null);
    assert.equal(actionFor(payment({}, MONTHLY_ID, 'payment.failed'), PRODUCTS), null);
    assert.equal(actionFor(payment({}, MONTHLY_ID, 'payment.processing'), PRODUCTS), null);
  });
  it('refunds are not handled: Premium ends with the subscription', () => {
    const refund = { type: 'refund.succeeded', data: { payload_type: 'Refund', refund_id: 'ref_1', payment_id: 'pay_1', status: 'succeeded', is_partial: false, metadata: { user_id: USER } } };
    assert.equal(actionFor(refund, PRODUCTS), null);
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
  it('subscription events with no known person or product, and things that are not events, give nothing', () => {
    assert.equal(actionFor(sub('active', { metadata: {} }), PRODUCTS), null);
    assert.equal(actionFor(sub('active', {}, OTHER_ID), PRODUCTS), null);
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

  it('the plan is a PATCH of one profile', async () => {
    const { calls, store: s } = store('eyJ.legacy.jwt');
    await s.apply({ kind: 'set-tier', userId: USER, tier: 'premium' });
    await s.apply({ kind: 'set-tier', userId: USER, tier: 'free' });
    assert.deepEqual([calls[0].method, calls[0].url, calls[0].body], ['PATCH', `https://x.supabase.co/rest/v1/profiles?id=eq.${USER}`, { tier: 'premium' }]);
    assert.deepEqual(calls[1].body, { tier: 'free' });
    assert.equal(calls[0].headers.Prefer, 'return=minimal');
  });
  it('a legacy key (a JWT) is also the bearer token; a new sb_secret key goes in apikey only', async () => {
    const legacy = store('eyJ.legacy.jwt');
    await legacy.store.apply({ kind: 'set-tier', userId: USER, tier: 'premium' });
    assert.equal(legacy.calls[0].headers.apikey, 'eyJ.legacy.jwt');
    assert.equal(legacy.calls[0].headers.Authorization, 'Bearer eyJ.legacy.jwt');
    const modern = store('sb_secret_abc');
    await modern.store.apply({ kind: 'set-tier', userId: USER, tier: 'premium' });
    assert.equal(modern.calls[0].headers.apikey, 'sb_secret_abc');
    assert.equal(modern.calls[0].headers.Authorization, undefined);
  });
  it('throws when Supabase refuses, so that Dodo delivers the event again', async () => {
    const { store: s } = store('k', 500);
    await assert.rejects(() => s.apply({ kind: 'set-tier', userId: USER, tier: 'free' }), /500/);
  });

  // A fake Supabase that keeps the app_metadata of one user.
  function withUsers(metadata: Record<string, unknown> | null, serviceKey = 'sb_secret_abc') {
    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
    const state = { metadata };
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes('/auth/v1/admin/users/')) {
        if (state.metadata === null) return new Response('{}', { status: 404 });
        if (method === 'PUT') state.metadata = (JSON.parse(String(init?.body)) as { app_metadata: Record<string, unknown> }).app_metadata;
        return Response.json({ id: USER, app_metadata: state.metadata });
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    return { calls, state, store: createPaymentStore({ url: 'https://x.supabase.co', serviceKey, fetchImpl }) };
  }

  it('saves the subscription id in the app_metadata of the user and keeps the other keys', async () => {
    const { calls, state, store: s } = withUsers({ provider: 'google', providers: ['google'] });
    await s.apply({ kind: 'set-tier', userId: USER, tier: 'premium', subscriptionId: 'sub_9' });
    assert.deepEqual(state.metadata, { provider: 'google', providers: ['google'], dodo_subscription_id: 'sub_9' });
    assert.deepEqual(
      calls.map((c) => `${c.method} ${c.url.replace('https://x.supabase.co', '')}`),
      [`PATCH /rest/v1/profiles?id=eq.${USER}`, `GET /auth/v1/admin/users/${USER}`, `PUT /auth/v1/admin/users/${USER}`],
    );
    assert.equal(calls[1].headers.apikey, 'sb_secret_abc');
    assert.equal(await s.subscriptionIdOf(USER), 'sub_9');
  });
  it('does not write again when the same id is already saved, and a plan change alone never touches the metadata', async () => {
    const same = withUsers({ dodo_subscription_id: 'sub_9' });
    await same.store.apply({ kind: 'set-tier', userId: USER, tier: 'premium', subscriptionId: 'sub_9' });
    assert.equal(same.calls.filter((c) => c.method === 'PUT').length, 0);
    const none = withUsers({});
    await none.store.apply({ kind: 'set-tier', userId: USER, tier: 'free' });
    assert.deepEqual(none.calls.map((c) => c.method), ['PATCH']);
  });
  it('a new subscription replaces the saved id', async () => {
    const { state, store: s } = withUsers({ dodo_subscription_id: 'sub_old' });
    await s.apply({ kind: 'set-tier', userId: USER, tier: 'premium', subscriptionId: 'sub_new' });
    assert.equal((state.metadata as Record<string, unknown>).dodo_subscription_id, 'sub_new');
  });
  it('fails (so that Dodo sends the event again) when the metadata cannot be saved', async () => {
    const { store: s } = withUsers(null);
    await assert.rejects(() => s.apply({ kind: 'set-tier', userId: USER, tier: 'premium', subscriptionId: 'sub_9' }), /404/);
  });
  it('subscriptionIdOf: nothing saved, a bad value and a bad user id all give null', async () => {
    assert.equal(await withUsers({}).store.subscriptionIdOf(USER), null);
    assert.equal(await withUsers({ dodo_subscription_id: '../x' }).store.subscriptionIdOf(USER), null);
    const { calls, store: s } = withUsers({ dodo_subscription_id: 'sub_9' });
    assert.equal(await s.subscriptionIdOf('../../etc'), null);
    assert.equal(calls.length, 0, 'a bad user id never reaches Supabase');
  });
});

describe('subscriptions', () => {
  const api: DodoApi = { apiKey: 'dodo_test_x', baseUrl: 'https://test.dodopayments.com' };
  const record = (extra: Record<string, unknown> = {}) => ({
    subscription_id: 'sub_1',
    status: 'active',
    metadata: { user_id: USER },
    next_billing_date: '2026-12-27T10:00:00Z',
    cancel_at_next_billing_date: false,
    ...extra,
  });
  // A fake Dodo with one subscription: GET reads it, PATCH with the cancel flag sets it.
  function dodo(initial: Record<string, unknown> | null, patchStatus = 200) {
    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
    let current = initial;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url: String(input), method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (!current) return new Response('{}', { status: 404 });
      if (method === 'PATCH') {
        if (patchStatus !== 200) return new Response('{}', { status: patchStatus });
        current = { ...current, ...JSON.parse(String(init?.body)) };
      }
      return Response.json(current);
    }) as typeof fetch;
    return { calls, fetchImpl };
  }
  const saved = (id: string | null): PaymentStore => ({ apply: async () => {}, subscriptionIdOf: async () => id });

  it('fetchSubscription reads the status, the next payment and whether the cancel is scheduled', async () => {
    const { calls, fetchImpl } = dodo(record({ cancel_at_next_billing_date: true }));
    const state = await fetchSubscription(api, 'sub_1', fetchImpl);
    assert.deepEqual(state, { id: 'sub_1', userId: USER, active: true, nextBillingDate: '2026-12-27T10:00:00.000Z', cancelScheduled: true });
    assert.equal(calls[0].url, 'https://test.dodopayments.com/subscriptions/sub_1');
    assert.equal(calls[0].headers.Authorization, 'Bearer dodo_test_x');
  });
  it('fetchSubscription: unknown to Dodo is null, any other failure throws, a dirty id never leaves the server', async () => {
    assert.equal(await fetchSubscription(api, 'sub_1', dodo(null).fetchImpl), null);
    const broken = (async () => new Response('{}', { status: 500 })) as typeof fetch;
    await assert.rejects(() => fetchSubscription(api, 'sub_1', broken), /500/);
    const { calls, fetchImpl } = dodo(record());
    assert.equal(await fetchSubscription(api, '../customers', fetchImpl), null);
    assert.equal(calls.length, 0);
    const odd = dodo(record({ status: 'cancelled', metadata: {}, next_billing_date: 'soon' }));
    assert.deepEqual(await fetchSubscription(api, 'sub_1', odd.fetchImpl), { id: 'sub_1', userId: null, active: false, nextBillingDate: null, cancelScheduled: false });
  });
  it('cancelSubscription asks Dodo to stop at the end of the paid period, not now', async () => {
    const { calls, fetchImpl } = dodo(record());
    await cancelSubscription(api, 'sub_1', fetchImpl);
    assert.deepEqual([calls[0].method, calls[0].url, calls[0].body], ['PATCH', 'https://test.dodopayments.com/subscriptions/sub_1', { cancel_at_next_billing_date: true }]);
    await assert.rejects(() => cancelSubscription(api, 'sub_1', dodo(record(), 422).fetchImpl), /422/);
    await assert.rejects(() => cancelSubscription(api, '../x', fetchImpl), /id/);
  });
  it('subscriptionOf finds the person’s running subscription, and nothing else', async () => {
    const mine = await subscriptionOf({ store: saved('sub_1'), api, userId: USER, fetchImpl: dodo(record()).fetchImpl });
    assert.equal(mine?.id, 'sub_1');
    assert.equal(await subscriptionOf({ store: saved(null), api, userId: USER, fetchImpl: dodo(record()).fetchImpl }), null, 'nothing saved');
    assert.equal(await subscriptionOf({ store: saved('sub_1'), api, userId: USER, fetchImpl: dodo(null).fetchImpl }), null, 'Dodo does not know it');
    assert.equal(await subscriptionOf({ store: saved('sub_1'), api, userId: USER, fetchImpl: dodo(record({ status: 'cancelled' })).fetchImpl }), null, 'ended');
    const other = '11111111-2222-4333-8444-555555555555';
    assert.equal(await subscriptionOf({ store: saved('sub_1'), api, userId: USER, fetchImpl: dodo(record({ metadata: { user_id: other } })).fetchImpl }), null, 'somebody else’s');
    assert.equal(await subscriptionOf({ store: saved('sub_1'), api, userId: USER, fetchImpl: dodo(record({ metadata: {} })).fetchImpl }), null, 'no owner on record');
  });
  it('cancelling the subscription of a person stops the renewal and keeps Premium until the period ends', async () => {
    const { calls, fetchImpl } = dodo(record());
    const result = await cancelUserSubscription({ store: saved('sub_1'), api, userId: USER, fetchImpl });
    assert.deepEqual(result, { ok: true, view: { managed: true, nextBillingDate: '2026-12-27T10:00:00.000Z', cancelScheduled: true } });
    assert.deepEqual(calls.map((c) => c.method), ['GET', 'PATCH'], 'the owner is checked first, then the cancel is sent');
    assert.deepEqual(calls[1].body, { cancel_at_next_billing_date: true });
  });
  it('cancelling twice is not an error and sends nothing the second time', async () => {
    const { calls, fetchImpl } = dodo(record({ cancel_at_next_billing_date: true }));
    const result = await cancelUserSubscription({ store: saved('sub_1'), api, userId: USER, fetchImpl });
    assert.equal(result.ok, true);
    assert.deepEqual(calls.map((c) => c.method), ['GET']);
  });
  it('cancelling: no subscription of the person is a 404, and nothing is sent to Dodo', async () => {
    const other = '11111111-2222-4333-8444-555555555555';
    for (const [store, fetchImpl] of [
      [saved(null), dodo(record()).fetchImpl],
      [saved('sub_1'), dodo(record({ metadata: { user_id: other } })).fetchImpl],
      [saved('sub_1'), dodo(record({ status: 'expired' })).fetchImpl],
    ] as const) {
      const calls: string[] = [];
      const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push(init?.method ?? 'GET');
        return fetchImpl(input, init);
      }) as typeof fetch;
      const result = await cancelUserSubscription({ store, api, userId: USER, fetchImpl: spy });
      assert.deepEqual([result.ok, !result.ok && result.status], [false, 404]);
      assert.ok(!calls.includes('PATCH'), 'no cancel was sent');
    }
  });
  it('cancelling: when Dodo or Supabase fail, the answer is a 502 with a message to try again', async () => {
    const failing = await cancelUserSubscription({ store: saved('sub_1'), api, userId: USER, fetchImpl: dodo(record(), 500).fetchImpl });
    assert.deepEqual([failing.ok, !failing.ok && failing.status], [false, 502]);
    const noSupabase: PaymentStore = { apply: async () => {}, subscriptionIdOf: async () => { throw new Error('down'); } };
    const unreachable = await cancelUserSubscription({ store: noSupabase, api, userId: USER, fetchImpl: dodo(record()).fetchImpl });
    assert.deepEqual([unreachable.ok, !unreachable.ok && unreachable.status], [false, 502]);
  });
  it('the view for the page', () => {
    assert.deepEqual(subscriptionView(null), NO_SUBSCRIPTION);
    assert.deepEqual(subscriptionView({ id: 'sub_1', userId: USER, active: true, nextBillingDate: '2026-12-27T10:00:00.000Z', cancelScheduled: false }), {
      managed: true,
      nextBillingDate: '2026-12-27T10:00:00.000Z',
      cancelScheduled: false,
    });
  });
});

describe('createCheckout', () => {
  const config: CheckoutConfig = { apiKey: 'dodo_test_x', baseUrl: 'https://test.dodopayments.com', offers: {} };
  const request = {
    config,
    offer: 'premium:yearly',
    productId: YEARLY_ID,
    userId: USER,
    email: 'ana@example.com',
    returnUrl: 'https://s.example/pricing?purchase=premium',
    cancelUrl: 'https://s.example/pricing',
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
      product_cart: [{ product_id: YEARLY_ID, quantity: 1 }],
      customer: { email: 'ana@example.com' },
      metadata: { user_id: USER, offer: 'premium:yearly' },
      return_url: 'https://s.example/pricing?purchase=premium',
      cancel_url: 'https://s.example/pricing',
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
