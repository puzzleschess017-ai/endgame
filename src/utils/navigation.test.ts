import assert from 'node:assert/strict';
import { test } from 'node:test';
import { internalTarget, isChunkError, isPagePath, normalizePath, type ClickInfo, type LinkInfo } from './navigation.ts';

const PAGES = ['/streak', '/survival', '/analysis', '/tablebase', '/endgames', '/openings', '/tactics', '/pricing'];
const HERE = { origin: 'https://example.org', pathname: '/streak', search: '' };
const CLICK: ClickInfo = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const link = (href: string, extra: Partial<LinkInfo> = {}): LinkInfo => ({ href, target: '', hasDownload: false, ...extra });
const go = (href: string, click: Partial<ClickInfo> = {}, extra: Partial<LinkInfo> = {}, here = HERE) =>
  internalTarget({ ...CLICK, ...click }, link(href, extra), here, PAGES);

test('a plain click on a link to a page of the app is handled by the app', () => {
  assert.equal(go('/survival'), '/survival');
  assert.equal(go('/survival/'), '/survival');
  assert.equal(go('/'), '/');
  assert.equal(go('https://example.org/pricing'), '/pricing');
  assert.equal(go('/analysis?fen=8%2F8%2F8%2F8%2F8%2F8%2F8%2F8'), '/analysis?fen=8%2F8%2F8%2F8%2F8%2F8%2F8%2F8');
  assert.equal(go('/endgames/lucena-position'), '/endgames/lucena-position');
  assert.equal(go('/tactics/fork#practise'), '/tactics/fork#practise');
});

test('a click that wants a new tab, another button or a modifier key is left to the browser', () => {
  for (const click of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }, { defaultPrevented: true }]) {
    assert.equal(go('/survival', click), null, JSON.stringify(click));
  }
  assert.equal(go('/survival', {}, { target: '_blank' }), null);
  assert.equal(go('/survival', {}, { target: '_self' }), '/survival');
  assert.equal(go('/survival', {}, { hasDownload: true }), null);
});

test('other sites, files, the API and the redirected address are left to the browser', () => {
  assert.equal(go('https://lichess.org/streak'), null);
  assert.equal(go('mailto:someone@example.org'), null);
  assert.equal(go('/sitemap.xml'), null);
  assert.equal(go('/api/ebooks/essential-endgames/download'), null);
  assert.equal(go('/tablebase?fen=x'), null, 'the server redirects it');
  assert.equal(go('/nope'), null);
  assert.equal(go('/lessons/fork'), null);
  assert.equal(go('http://[::1'), null, 'a broken address does not throw');
});

test('a link to a place on the same page is left to the browser, a link to the same page with another query is not', () => {
  assert.equal(go('#top'), null);
  assert.equal(go('/streak#top'), null);
  assert.equal(go('/streak?x=1#top'), '/streak?x=1#top');
  assert.equal(go('/survival#top'), '/survival#top');
});

test('page addresses', () => {
  assert.equal(normalizePath('/streak///'), '/streak');
  assert.equal(normalizePath(''), '/');
  assert.ok(isPagePath('/', PAGES));
  assert.ok(isPagePath('/tactics/zugzwang', PAGES));
  assert.ok(!isPagePath('/tactics-old/zugzwang', PAGES));
  assert.ok(!isPagePath('/streak/extra', PAGES), 'only the indexes have lessons below them');
  assert.ok(!isPagePath('/ebooks/x', PAGES));
});

test('the errors of a page file that cannot be loaded are recognised, other errors are not', () => {
  assert.ok(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/StreakPage-abc.js')));
  assert.ok(isChunkError(new TypeError('error loading dynamically imported module')));
  assert.ok(isChunkError(new TypeError('Importing a module script failed.')));
  assert.ok(!isChunkError(new Error('Cannot read properties of undefined')));
  assert.ok(!isChunkError(undefined));
});
