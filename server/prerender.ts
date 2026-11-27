// The text of the pages, written into the HTML the server sends. The app builds its pages in the
// browser, and a search engine that has not run the JavaScript yet (or does not run it) would only see the
// short intro of index.html. So for /endgames, /openings, /tactics and every lesson the server writes the
// headings and paragraphs of the lesson into the page, and every training page, the eBooks and the Pricing
// page get a short description of what they are, with links to the rest of the site. It is built from the same data as the real page
// (src/theory), so the two can not drift apart, and the app replaces it as soon as it starts.

import { ENDGAMES } from '../src/theory/endgames.ts';
import { OPENINGS } from '../src/theory/openings.ts';
import { TACTICS } from '../src/theory/tactics.ts';
import type { Lesson, Section, TheoryCollection } from '../src/theory/types.ts';
import { EBOOKS } from '../src/utils/ebooks.ts';
import { pricingGroups, type Cell } from '../src/utils/pricing.ts';
import { PREMIUM_MONTHLY_LABEL, PREMIUM_YEARLY_LABEL, yearlySavingPercent } from '../src/utils/premium.ts';
import { escapeHtml, PAGES, SITE_NAME } from './seo.ts';

const COLLECTIONS: TheoryCollection[] = [ENDGAMES, OPENINGS, TACTICS];

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
  const trainingLinks = (collection.training ?? []).map((link) => `<a href="${link.href}">${escapeHtml(link.label)}</a>`);
  parts.push(
    collection.woodpecker
      ? `<p>${escapeHtml(collection.practiceText)} <a href="/woodpecker">Woodpecker method: chess endgame training</a></p>`
      : `<p>${escapeHtml(collection.practiceText)}${trainingLinks.length ? ` Train it with ${trainingLinks.join(' or ')}.` : ''}</p>`,
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

interface AppText {
  h1: string;
  paragraphs: string[];
  bullets?: string[];
  /** The link under the text: where to start. */
  start?: { href: string; label: string };
}

/** The training pages in the order of the menu: the links on every one of them. */
const SITE_LINKS = ['/woodpecker', '/streak', '/survival', '/coordinates', '/blindfold', '/analysis', '/editor', '/endgames', '/openings', '/tactics', '/ebooks', '/pricing'];

function cellText(cell: Cell): string {
  return cell === true ? 'yes' : cell === false ? 'no' : cell;
}

function pricingBullets(): string[] {
  const bullets: string[] = [];
  for (const group of pricingGroups()) {
    for (const row of group.rows) {
      bullets.push(`${group.title}, ${row.label.charAt(0).toLowerCase()}${row.label.slice(1)}: guest ${cellText(row.guest)}; free account ${cellText(row.free)}; Premium ${cellText(row.premium)}.`);
    }
  }
  return bullets;
}

/** What each page is, in plain words. The numbers come from the same rules as the app (access, pricing), so they can not drift. */
function appTexts(): Record<string, AppText> {
  return {
    '/': {
      h1: SITE_NAME,
      paragraphs: [
        'Free chess training in the browser: endgames with the Woodpecker method, puzzles in Puzzle Streak and Puzzle Survival, a coordinates trainer, blindfold chess drills, and a board where you can check any position with the Stockfish engine.',
        'The Woodpecker method means solving the same set of puzzles again and again, a little faster every cycle, until the patterns come without thinking. Start as a guest, or sign in to keep your results and statistics on every device.',
      ],
      start: { href: '/woodpecker', label: 'Start training with the Woodpecker method' },
    },
    '/woodpecker': {
      h1: 'Woodpecker Method: Chess Endgame Training',
      paragraphs: [
        'Choose a set of puzzles from the Lichess database, solve it, then solve the same set again, faster each cycle. Repeating the same positions is how the patterns stick.',
        'You choose how many puzzles are in a set (10 to 500), how many cycles you go through (2 to 9), the difficulty (Easy, Medium, Hard, Expert or Mixed) and the puzzle type (classic or endgame). Guests and free accounts get the smaller sets; Premium opens every option.',
      ],
      start: { href: '/woodpecker', label: 'Start a Woodpecker set' },
    },
    '/streak': {
      h1: 'Puzzle Streak',
      paragraphs: ['Solve chess puzzles that get harder one by one. One wrong move ends your streak, so the aim is to get as far as you can and beat your best streak.'],
      start: { href: '/streak', label: 'Start a streak' },
    },
    '/survival': {
      h1: 'Puzzle Survival',
      paragraphs: ['Solve chess puzzles that get harder one by one. You have 3 lives and no clock: every wrong move costs a life, and the run ends when the last life is gone.'],
      start: { href: '/survival', label: 'Start a survival run' },
    },
    '/coordinates': {
      h1: 'Chess Coordinates Trainer',
      paragraphs: ['Practice the names of the squares against the clock: a square is named, and you click it on the board as fast as you can. Knowing the coordinates by heart makes notation, puzzles and blindfold chess easier.'],
      start: { href: '/coordinates', label: 'Start the coordinates trainer' },
    },
    '/blindfold': {
      h1: 'Blindfold Chess Training',
      paragraphs: [
        'Memorize the position, then the pieces disappear and you find the checkmate without seeing them. You choose how many pieces are on the board, how long you have to memorize and how many moves the mate takes.',
        'There are also drills, such as naming the colour of a square. A free account gets the first levels; Premium opens every level and every drill.',
      ],
      start: { href: '/blindfold', label: 'Start blindfold training' },
    },
    '/analysis': {
      h1: 'Board Analysis',
      paragraphs: ['Set up or load any chess position, play moves on the board and check them with the Stockfish engine. The engine is free for everybody, no account needed.'],
      start: { href: '/analysis', label: 'Open the analysis board' },
    },
    '/editor': {
      h1: 'Board Editor',
      paragraphs: ['A free chess board editor: set up any position with the pieces you want, copy the FEN, or open the position in Board Analysis to check it with the engine.'],
      start: { href: '/editor', label: 'Open the board editor' },
    },
    '/ebooks': {
      h1: 'eBooks',
      paragraphs: ['Chess books with diagrams, plans, traps and exercises. They are free to download with Premium.'],
      bullets: EBOOKS.map((book) => `${book.title}: ${book.subtitle} (PDF, ${book.pages} pages, English).`),
    },
    '/pricing': {
      h1: 'Free and Premium',
      paragraphs: [
        `Training is free. Premium opens every Woodpecker and Blindfold option and every drill, and the e-books are free to download with it. Premium costs ${PREMIUM_MONTHLY_LABEL} a month, or ${PREMIUM_YEARLY_LABEL} a year (save ${yearlySavingPercent()}%). Payment is handled by Dodo Payments, and you can cancel at any time.`,
        'What each kind of visitor gets:',
      ],
      bullets: pricingBullets(),
    },
  };
}

function siteLinks(current: string): string {
  const items = SITE_LINKS.filter((path) => path !== current)
    .map((path) => PAGES.find((page) => page.path === path))
    .filter((page): page is NonNullable<typeof page> => page !== undefined)
    .map((page) => `<li><a href="${page.path}">${escapeHtml(page.title.replace(` | ${SITE_NAME}`, ''))}</a></li>`);
  return `<h2>More on ${SITE_NAME}</h2>\n<ul>${items.join('')}</ul>`;
}

function appHtml(path: string, text: AppText): string {
  const parts = [`<h1>${escapeHtml(text.h1)}</h1>`, ...text.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)];
  if (text.bullets?.length) parts.push(`<ul>${text.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
  if (text.start) parts.push(`<p><a href="${text.start.href}">${escapeHtml(text.start.label)}</a></p>`);
  parts.push(siteLinks(path));
  return parts.join('\n');
}

/** The text of the page at this path (a training page, an index page or a lesson), or undefined for every other page. */
export function contentFor(pathname: string): string | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  const text = appTexts()[path];
  if (text) return wrap(appHtml(path, text));
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
