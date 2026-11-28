import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatLongDate, parseSubscription, subscriptionSentence } from './subscription.ts';

describe('parseSubscription', () => {
  it('reads what the server sends', () => {
    assert.deepEqual(parseSubscription({ managed: true, nextBillingDate: '2026-12-27T10:00:00.000Z', cancelScheduled: false }), {
      managed: true,
      nextBillingDate: '2026-12-27T10:00:00.000Z',
      cancelScheduled: false,
    });
    assert.equal(parseSubscription({ managed: true, nextBillingDate: null, cancelScheduled: true }).cancelScheduled, true);
  });
  it('anything else means there is nothing to manage', () => {
    const nothing = { managed: false, nextBillingDate: null, cancelScheduled: false };
    for (const body of [null, undefined, 'x', 7, [], {}, { managed: 'yes' }, { error: 'down' }]) assert.deepEqual(parseSubscription(body), nothing);
    assert.equal(parseSubscription({ managed: true, nextBillingDate: 'soon' }).nextBillingDate, null, 'a date that is not a date is dropped');
  });
});

describe('subscriptionSentence', () => {
  it('says when it renews, and what a cancel means', () => {
    assert.match(subscriptionSentence({ managed: true, nextBillingDate: '2026-12-27T12:00:00.000Z', cancelScheduled: false }), /^Your subscription renews on December 2[67], 2026\.$/);
    const cancelled = subscriptionSentence({ managed: true, nextBillingDate: '2026-12-27T12:00:00.000Z', cancelScheduled: true });
    assert.match(cancelled, /cancelled\. You keep Premium until December 2[67], 2026/);
    assert.match(cancelled, /not be charged again/);
  });
  it('still makes sense when Dodo gave no date', () => {
    assert.equal(subscriptionSentence({ managed: true, nextBillingDate: null, cancelScheduled: false }), 'Your subscription renews automatically.');
    assert.match(subscriptionSentence({ managed: true, nextBillingDate: null, cancelScheduled: true }), /until the end of the period you have paid for/);
  });
});

describe('formatLongDate', () => {
  it('is a long English date', () => {
    assert.match(formatLongDate('2026-03-05T12:00:00.000Z'), /^March [45], 2026$/);
  });
});
