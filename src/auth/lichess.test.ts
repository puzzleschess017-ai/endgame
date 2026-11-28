import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lichessMessage, lichessStartHref, parseLichessHash } from './lichess.ts';

describe('the return from Lichess', () => {
  it('reads the token and a safe next page from the fragment', () => {
    assert.deepEqual(parseLichessHash('#lichess=abcDEF123_-xyz789&next=%2Fstreak'), { token: 'abcDEF123_-xyz789', next: '/streak' });
  });
  it('no token, a odd token, or an unsafe next page', () => {
    assert.equal(parseLichessHash(''), null);
    assert.equal(parseLichessHash('#lichess=short'), null);
    assert.equal(parseLichessHash('#lichess=abc%20def%20ghijk'), null);
    assert.equal(parseLichessHash('#lichess=abcDEF123_-xyz789&next=%2F%2Fevil.com')?.next, '/');
    assert.equal(parseLichessHash('#lichess=abcDEF123_-xyz789&next=https%3A%2F%2Fevil.com')?.next, '/');
  });
  it('words the reasons of a failure, and says nothing when there is none', () => {
    assert.match(lichessMessage('?lichess=denied')!, /cancelled/);
    assert.match(lichessMessage('?lichess=no_email')!, /email/);
    assert.match(lichessMessage('?lichess=whatever')!, /not available/);
    assert.equal(lichessMessage('?tab=signup'), null);
  });
  it('the start address keeps the page to come back to', () => {
    assert.equal(lichessStartHref('/'), '/auth/lichess');
    assert.equal(lichessStartHref('/streak'), '/auth/lichess?next=%2Fstreak');
  });
});
