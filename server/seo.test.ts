import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import {
  PAGES,
  cleanSiteUrl,
  escapeHtml,
  normalizePath,
  pageFor,
  renderPage,
  robotsTxt,
  sitemapXml,
} from './seo.ts';

const TEMPLATE = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SITE = 'https://example.org';

describe('page table', () => {
  it('has a unique path, a title and a description of sensible length for every page', () => {
    assert.equal(new Set(PAGES.map((p) => p.path)).size, PAGES.length);
    for (const p of PAGES) {
      assert.ok(p.title.length > 10 && p.title.length <= 70, `${p.path} title: ${p.title.length}`);
      assert.ok(p.description.length >= 50 && p.description.length <= 170, `${p.path} description: ${p.description.length}`);
    }
  });
  it('knows every page of the app', () => {
    for (const path of ['/', '/woodpecker', '/streak', '/race', '/coordinates', '/blindfold', '/statistics', '/editor', '/tablebase']) {
      assert.ok(pageFor(path), path);
    }
  });
  it('ignores a trailing slash and refuses unknown paths', () => {
    assert.equal(normalizePath('/streak///'), '/streak');
    assert.equal(normalizePath('/'), '/');
    assert.equal(pageFor('/streak/')?.path, '/streak');
    assert.equal(pageFor('/nope'), undefined);
  });
});

describe('cleanSiteUrl', () => {
  it('accepts an origin and drops the final slash', () => {
    assert.equal(cleanSiteUrl('https://a.example/'), 'https://a.example');
  });
  it('falls back to the real site for anything else', () => {
    assert.equal(cleanSiteUrl(undefined), 'https://chesstacticsguide.com');
    assert.equal(cleanSiteUrl('javascript:alert(1)'), 'https://chesstacticsguide.com');
    assert.equal(cleanSiteUrl('https://a.example/path'), 'https://chesstacticsguide.com');
  });
});

describe('renderPage', () => {
  it('puts the title, description and canonical address of the page in the head', () => {
    const page = pageFor('/streak')!;
    const html = renderPage(TEMPLATE, page, SITE);
    assert.match(html, /<title>Puzzle Streak \| Chess Tactics Guide<\/title>/);
    assert.ok(html.includes(`<meta name="description" content="${page.description}" />`));
    assert.ok(html.includes('<link rel="canonical" href="https://example.org/streak" />'));
    assert.ok(html.includes('<meta property="og:url" content="https://example.org/streak" />'));
    assert.ok(html.includes('<meta name="robots" content="index, follow" />'));
  });
  it('has exactly one of each tag (the generic ones of index.html are replaced)', () => {
    const html = renderPage(TEMPLATE, pageFor('/')!, SITE);
    assert.equal(html.match(/<title>/g)?.length, 1);
    assert.equal(html.match(/name="description"/g)?.length, 1);
    assert.equal(html.match(/property="og:title"/g)?.length, 1);
    assert.equal(html.match(/name="twitter:card"/g)?.length, 1);
    assert.equal(html.match(/rel="canonical"/g)?.length, 1);
    assert.ok(html.includes('<div id="root"></div>'));
    assert.ok(html.includes('googletagmanager'));
  });
  it('keeps the Google Search Console verification tag on every page', () => {
    for (const page of [...PAGES, undefined]) {
      assert.ok(renderPage(TEMPLATE, page, SITE).includes('name="google-site-verification"'));
    }
  });
  it('the home canonical is the bare site address with a slash', () => {
    assert.ok(renderPage(TEMPLATE, pageFor('/')!, SITE).includes('<link rel="canonical" href="https://example.org/" />'));
  });
  it('writes valid structured data', () => {
    for (const page of PAGES.filter((p) => p.indexable)) {
      const html = renderPage(TEMPLATE, page, SITE);
      const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      assert.ok(match, page.path);
      const data = JSON.parse(match[1]);
      assert.equal(data['@type'], page.kind === 'website' ? 'WebSite' : 'WebApplication');
      assert.ok(String(data.url).startsWith(SITE));
    }
  });
  it('asks search engines to skip a personal page and gives it no structured data or sitemap entry', () => {
    const html = renderPage(TEMPLATE, pageFor('/statistics')!, SITE);
    assert.ok(html.includes('<meta name="robots" content="noindex, follow" />'));
    assert.ok(!html.includes('ld+json'));
    assert.ok(!sitemapXml(SITE).includes('/statistics'));
  });
  it('marks an unknown path noindex and gives it no canonical address', () => {
    const html = renderPage(TEMPLATE, undefined, SITE);
    assert.match(html, /<title>Page not found/);
    assert.ok(html.includes('noindex'));
    assert.ok(!html.includes('rel="canonical"'));
  });
  it('escapes quotes and angle brackets', () => {
    assert.equal(escapeHtml('a "b" <c> & d'), 'a &quot;b&quot; &lt;c&gt; &amp; d');
  });
});

describe('robots.txt and sitemap.xml', () => {
  it('robots.txt allows the site, keeps crawlers out of the API and points to the sitemap', () => {
    const text = robotsTxt(SITE);
    assert.match(text, /^User-agent: \*\nAllow: \/\nDisallow: \/api\/\n/);
    assert.ok(text.includes('Sitemap: https://example.org/sitemap.xml'));
  });
  it('the sitemap lists every indexable page once, with full addresses', () => {
    const xml = sitemapXml(SITE);
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    assert.equal(locs.length, PAGES.filter((p) => p.indexable).length);
    assert.equal(new Set(locs).size, locs.length);
    assert.ok(locs.includes('https://example.org/'));
    assert.ok(locs.includes('https://example.org/tablebase'));
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  });
});
