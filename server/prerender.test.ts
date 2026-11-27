import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LESSONS, lessonPath } from '../src/theory/endgames.ts';
import { OPENING_LESSONS, openingPath } from '../src/theory/openings.ts';
import { contentFor } from './prerender.ts';
import { EBOOKS } from '../src/utils/ebooks.ts';
import { PREMIUM_MONTHLY_LABEL, PREMIUM_YEARLY_LABEL } from '../src/utils/premium.ts';
import { escapeHtml, pageFor, renderPage } from './seo.ts';

const TEMPLATE = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';

describe('theory pages written into the HTML', () => {
  it('a lesson page has its heading, every section heading and the text', () => {
    for (const lesson of LESSONS) {
      const html = contentFor(lessonPath(lesson.slug));
      assert.ok(html, lesson.slug);
      assert.ok(html.includes('<h1>'), lesson.slug);
      for (const section of lesson.sections) assert.ok(html.includes(`<h2>${section.heading.replace(/&/g, '&amp;')}</h2>`), `${lesson.slug}: ${section.heading}`);
      assert.ok(html.length > 1500, `${lesson.slug} is only ${html.length} characters`);
    }
  });
  it('every lesson of both collections links to the lessons it names as related', () => {
    for (const lesson of LESSONS) {
      const html = contentFor(lessonPath(lesson.slug))!;
      for (const slug of lesson.related) assert.ok(html.includes(`href="${lessonPath(slug)}"`), `${lesson.slug} -> ${slug}`);
    }
    for (const lesson of OPENING_LESSONS) {
      const html = contentFor(openingPath(lesson.slug))!;
      assert.ok(html.includes(`<h1>${lesson.title.replace(/&/g, '&amp;')}</h1>`), lesson.slug);
      for (const slug of lesson.related) assert.ok(html.includes(`href="${openingPath(slug)}"`), `${lesson.slug} -> ${slug}`);
    }
  });
  it('the index pages list every lesson as a link', () => {
    const endgames = contentFor('/endgames')!;
    for (const lesson of LESSONS) assert.ok(endgames.includes(`href="${lessonPath(lesson.slug)}"`), lesson.slug);
    const openings = contentFor('/openings/')!;
    for (const lesson of OPENING_LESSONS) assert.ok(openings.includes(`href="${openingPath(lesson.slug)}"`), lesson.slug);
  });
  it('personal pages and unknown lessons have no text of their own', () => {
    assert.equal(contentFor('/statistics'), undefined);
    assert.equal(contentFor('/login'), undefined);
    assert.equal(contentFor('/endgames/no-such-lesson'), undefined);
  });
  it('text is escaped, so a lesson can never write markup', () => {
    const html = contentFor('/endgames/stalemate-tricks')!;
    assert.ok(!/<script/i.test(html));
  });
  it('renderPage puts the text into the root element and keeps a "$" as it is', () => {
    const page = pageFor('/endgames/lucena-position');
    const out = renderPage(TEMPLATE, page, 'https://example.org', '<main>costs $4.99 and $&</main>');
    assert.ok(out.includes('<div id="root"><main>costs $4.99 and $&</main></div>'));
    assert.equal((out.match(/<div id="root">/g) ?? []).length, 1);
  });
  it('a page without text leaves the root element empty', () => {
    const out = renderPage(TEMPLATE, pageFor('/privacy'), 'https://example.org');
    assert.ok(out.includes('<div id="root"></div>'));
  });
});

describe('training pages written into the HTML', () => {
  const PATHS = ['/', '/woodpecker', '/streak', '/survival', '/coordinates', '/blindfold', '/analysis', '/editor', '/ebooks', '/pricing'];
  it('every training page has its own heading and text, not the text of the home page', () => {
    const seen = new Set<string>();
    for (const path of PATHS) {
      const html = contentFor(path);
      assert.ok(html, path);
      assert.equal((html.match(/<h1>/g) ?? []).length, 1, path);
      assert.ok(html.length > 600, `${path} is only ${html.length} characters`);
      const h1 = /<h1>(.*?)<\/h1>/.exec(html)![1];
      assert.ok(!seen.has(h1), `${path} repeats the heading ${h1}`);
      seen.add(h1);
    }
  });
  it('each page links to the other pages of the site, and the home page and Survival replace the old Race', () => {
    for (const path of PATHS) {
      const html = contentFor(path)!;
      assert.ok(html.includes('href="/survival"') || path === '/survival', path);
      assert.ok(!html.includes('/race'), path);
      assert.ok(!html.includes('Puzzle Race'), path);
    }
  });
  it('the home page has a link to start', () => {
    assert.ok(contentFor('/')!.includes('href="/woodpecker">Start training'));
  });
  it('the e-books page lists every e-book and the Pricing page the prices and the table', () => {
    const books = contentFor('/ebooks')!;
    for (const book of EBOOKS) assert.ok(books.includes(escapeHtml(book.title)), book.slug);
    const pricing = contentFor('/pricing')!;
    assert.ok(pricing.includes(PREMIUM_MONTHLY_LABEL) && pricing.includes(PREMIUM_YEARLY_LABEL));
    assert.ok(pricing.includes('Premium Up to 9') || pricing.includes('Premium 9'), 'the table has the Premium limits');
  });
  it('every page that has text is a page of the sitemap', () => {
    for (const path of PATHS) assert.ok(pageFor(path)?.indexable, path);
  });
});
