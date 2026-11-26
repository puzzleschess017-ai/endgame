// The text of the theory pages, written into the HTML the server sends. The app builds these pages in the
// browser, and a search engine that has not run the JavaScript yet (or does not run it) would only see the
// short intro of index.html. So for /endgames, /openings and every lesson the server also writes the
// headings and paragraphs of the lesson into the page. It is built from the same data as the real page
// (src/theory), so the two can not drift apart, and the app replaces it as soon as it starts.

import { ENDGAMES } from '../src/theory/endgames.ts';
import { OPENINGS } from '../src/theory/openings.ts';
import type { Lesson, Section, TheoryCollection } from '../src/theory/types.ts';
import { escapeHtml } from './seo.ts';

const COLLECTIONS: TheoryCollection[] = [ENDGAMES, OPENINGS];

const WRAPPER_STYLE = 'max-width:720px;margin:0 auto;padding:24px;line-height:1.6';
// The page's stylesheet resets headings and lists, so give the text a plain look for the moment before the
// app starts (and for a reader without JavaScript). The style element goes away together with the text.
const TEXT_STYLE =
  '<style>[data-prerendered] h1{font-size:1.75rem;font-weight:700;margin:0 0 .75em}[data-prerendered] h2{font-size:1.25rem;font-weight:700;margin:1.5em 0 .5em}' +
  '[data-prerendered] p,[data-prerendered] ul,[data-prerendered] nav{margin:0 0 1em}[data-prerendered] ul{list-style:disc;padding-left:1.25rem}[data-prerendered] a{text-decoration:underline}</style>';

function sectionHtml(section: Section): string {
  const parts = [`<h2>${escapeHtml(section.heading)}</h2>`];
  for (const text of section.paragraphs ?? []) parts.push(`<p>${escapeHtml(text)}</p>`);
  if (section.bullets?.length) parts.push(`<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
  if (section.diagram) parts.push(`<figure><figcaption>${escapeHtml(section.diagram.caption)}</figcaption></figure>`);
  return parts.join('\n');
}

function linkList(collection: TheoryCollection, lessons: Lesson[]): string {
  const items = lessons.map(
    (lesson) => `<li><a href="${collection.pathFor(lesson.slug)}">${escapeHtml(lesson.title)}</a>: ${escapeHtml(lesson.summary)}</li>`,
  );
  return `<ul>${items.join('')}</ul>`;
}

function lessonHtml(collection: TheoryCollection, lesson: Lesson): string {
  const related = lesson.related.map((slug) => collection.bySlug(slug)).filter((item): item is Lesson => item !== undefined);
  const parts = [
    `<nav aria-label="Breadcrumb"><a href="${collection.base}">${escapeHtml(collection.name)}</a></nav>`,
    `<h1>${escapeHtml(lesson.title)}</h1>`,
    ...lesson.intro.map((text) => `<p>${escapeHtml(text)}</p>`),
    ...lesson.sections.map(sectionHtml),
  ];
  if (related.length) parts.push('<h2>Keep reading</h2>', linkList(collection, related));
  parts.push(
    collection.woodpecker
      ? `<p>${escapeHtml(collection.practiceText)} <a href="/woodpecker">Woodpecker method: chess endgame training</a></p>`
      : `<p>${escapeHtml(collection.practiceText)}</p>`,
    `<p><a href="${collection.base}">${escapeHtml(collection.allLabel)}</a></p>`,
  );
  return parts.join('\n');
}

function indexHtml(collection: TheoryCollection): string {
  const parts = [`<h1>${escapeHtml(collection.index.heading)}</h1>`, `<p>${escapeHtml(collection.index.intro)}</p>`];
  for (const group of collection.groups) {
    const lessons = collection.lessons.filter((lesson) => lesson.group === group);
    if (lessons.length) parts.push(`<h2>${escapeHtml(group)}</h2>`, linkList(collection, lessons));
  }
  return parts.join('\n');
}

/** The text of the page at this path (an index page or a lesson), or undefined for every other page. */
export function contentFor(pathname: string): string | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const collection of COLLECTIONS) {
    if (path === collection.base) return wrap(indexHtml(collection));
    const lesson = collection.forPath(path);
    if (lesson) return wrap(lessonHtml(collection, lesson));
  }
  return undefined;
}

function wrap(html: string): string {
  return `${TEXT_STYLE}<main data-prerendered style="${WRAPPER_STYLE}">\n${html}\n</main>`;
}
