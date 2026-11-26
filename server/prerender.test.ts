import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LESSONS, lessonPath } from '../src/theory/endgames.ts';
import { OPENING_LESSONS, openingPath } from '../src/theory/openings.ts';
import { contentFor } from './prerender.ts';
import { pageFor, renderPage } from './seo.ts';

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
  it('other pages and unknown lessons have no text of their own', () => {
    assert.equal(contentFor('/'), undefined);
    assert.equal(contentFor('/streak'), undefined);
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
    const out = renderPage(TEMPLATE, pageFor('/streak'), 'https://example.org');
    assert.ok(out.includes('<div id="root"></div>'));
  });
});
