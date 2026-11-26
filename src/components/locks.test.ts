import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UnlockLinks } from './locks.tsx';

const render = (tier: 'guest' | 'free' | 'premium') => renderToStaticMarkup(createElement(UnlockLinks, { tier }));

test('a guest is told that a free account unlocks some options, before the Premium link', () => {
  const html = render('guest');
  assert.match(html, /data-testid="create-account-link"/);
  assert.match(html, /href="\/login\?tab=signup&amp;next=%2F"/);
  assert.match(html, /Free account: unlock more options/);
  assert.match(html, /data-testid="get-premium-link"/);
  assert.ok(html.indexOf('create-account-link') < html.indexOf('get-premium-link'));
});

test('a page with its own create-account button can leave the account link out', () => {
  const html = renderToStaticMarkup(createElement(UnlockLinks, { tier: 'guest', accountLink: false }));
  assert.doesNotMatch(html, /create-account-link/);
  assert.match(html, /data-testid="get-premium-link"/);
});

test('a signed-in free account only sees the Premium link', () => {
  const html = render('free');
  assert.doesNotMatch(html, /create-account-link/);
  assert.match(html, /data-testid="get-premium-link"/);
});

test('a Premium account sees no links', () => {
  assert.equal(render('premium'), '');
});
