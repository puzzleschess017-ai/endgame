import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PREMIUM_MONTHLY_LABEL, PREMIUM_YEARLY_LABEL, priceLabel, yearlySavingPercent } from './premium.ts';

describe('Premium prices', () => {
  it('are shown as dollars and cents', () => {
    assert.equal(PREMIUM_MONTHLY_LABEL, '$4.99');
    assert.equal(PREMIUM_YEARLY_LABEL, '$39.99');
    assert.equal(priceLabel(199), '$1.99');
    assert.equal(priceLabel(5), '$0.05');
  });
  it('the yearly plan saves a third against twelve months', () => {
    assert.equal(yearlySavingPercent(), 33);
    assert.equal(yearlySavingPercent(1000, 12000), 0);
  });
});
