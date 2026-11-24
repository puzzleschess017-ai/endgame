import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsCookieNames, parseConsent } from './consent.ts';

describe('parseConsent', () => {
  it('accepts only the two saved values', () => {
    assert.equal(parseConsent('granted'), 'granted');
    assert.equal(parseConsent('denied'), 'denied');
    assert.equal(parseConsent(null), null);
    assert.equal(parseConsent(''), null);
    assert.equal(parseConsent('yes'), null);
  });
});

describe('analyticsCookieNames', () => {
  it('picks out the Google cookies and nothing else', () => {
    const header = 'sb-token=abc; _ga=GA1.1.1; _ga_ABC123=GS1; _gid=x; _gat_gtag_UA=1; _gcl_au=1; theme=dark';
    assert.deepEqual(analyticsCookieNames(header), ['_ga', '_ga_ABC123', '_gid', '_gat_gtag_UA', '_gcl_au']);
  });
  it('handles an empty cookie string', () => {
    assert.deepEqual(analyticsCookieNames(''), []);
  });
});
