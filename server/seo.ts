// What search engines and link previews see: a title, description, canonical address and a few tags per
// page, put into index.html by the server (the app itself is built in the browser, and not every crawler
// runs it), plus robots.txt and sitemap.xml.

export const DEFAULT_SITE_URL = 'https://chesstacticsguide.com';
export const SITE_NAME = 'Chess Tactics Guide';
const LOGO_PATH = '/assets/aistudio/Add_a_heading__16_-removebg-preview_c70fa2ca.png';

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  /** false: asks search engines not to list the page (personal pages) and keeps it out of the sitemap. */
  indexable: boolean;
  /** Page type for structured data: the home page is the website itself, the rest are free web apps, text pages or lessons. */
  kind: 'website' | 'app' | 'info' | 'article';
  priority: number;
}

export const PAGES: PageMeta[] = [
  {
    path: '/',
    title: 'Chess Tactics Guide | Chess training: endgames, puzzles and blindfold',
    description:
      'Free chess training: Woodpecker endgames, puzzle streaks and races, coordinates and blindfold drills. Sign in to keep your results on every device.',
    indexable: true,
    kind: 'website',
    priority: 1.0,
  },
  {
    path: '/woodpecker',
    title: 'Woodpecker Method: Chess Endgame Training | Chess Tactics Guide',
    description:
      'Train chess endgames with the Woodpecker method: solve the same set of puzzles again and again, faster every cycle. Free, with puzzles from the Lichess database.',
    indexable: true,
    kind: 'app',
    priority: 0.9,
  },
  {
    path: '/streak',
    title: 'Puzzle Streak | Chess Tactics Guide',
    description: 'Puzzle Streak: solve chess puzzles that get harder one by one. One wrong move ends your streak.',
    indexable: true,
    kind: 'app',
    priority: 0.8,
  },
  {
    path: '/race',
    title: 'Puzzle Race | Chess Tactics Guide',
    description: 'Puzzle Race: solve as many chess puzzles as you can in 1, 3 or 5 minutes. A wrong move costs 10 seconds.',
    indexable: true,
    kind: 'app',
    priority: 0.8,
  },
  {
    path: '/coordinates',
    title: 'Chess Coordinates Trainer | Chess Tactics Guide',
    description: 'Practice chess board coordinates against the clock: click the named square as fast as you can.',
    indexable: true,
    kind: 'app',
    priority: 0.8,
  },
  {
    path: '/blindfold',
    title: 'Blindfold Chess Training | Chess Tactics Guide',
    description:
      'Blindfold chess training: memorize the position, then find the checkmate in one move without seeing the pieces.',
    indexable: true,
    kind: 'app',
    priority: 0.8,
  },
  {
    path: '/tablebase',
    title: 'Endgame Tablebase | Chess Tactics Guide',
    description:
      'Endgame tablebase: perfect play for any chess position with 7 pieces or fewer. See who wins and the best move.',
    indexable: true,
    kind: 'app',
    priority: 0.8,
  },
  {
    path: '/editor',
    title: 'Board Editor | Chess Tactics Guide',
    description: 'Free chess board editor: set up any position, then copy the FEN or check it in the endgame tablebase.',
    indexable: true,
    kind: 'app',
    priority: 0.6,
  },
  {
    path: '/endgames',
    title: 'Chess Endgame Theory and Lessons | Chess Tactics Guide',
    description:
      'Free chess endgame lessons with diagrams: the Lucena and Philidor positions, the opposition, king and rook mate, king and queen mate and the wrong-colored bishop.',
    indexable: true,
    kind: 'info',
    priority: 0.8,
  },
  {
    path: '/endgames/king-and-pawn-opposition',
    title: 'Opposition and Key Squares in Pawn Endings | Chess Tactics Guide',
    description:
      'Learn the opposition and key squares in king and pawn endgames, and see why the same position is a win or a draw depending on who is to move.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/king-and-rook-vs-king',
    title: 'King and Rook vs King: The Box Method | Chess Tactics Guide',
    description:
      'How to checkmate with a king and rook against a lone king in at most 16 moves: cut the king off, shrink the box and give mate on the edge.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/king-and-queen-vs-king',
    title: 'King and Queen vs King: Mate Without Stalemate | Chess Tactics Guide',
    description:
      'How to checkmate with a king and queen against a lone king in at most 10 moves, and how to avoid the stalemate trap.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/lucena-position',
    title: 'The Lucena Position: How to Win a Rook Endgame | Chess Tactics Guide',
    description:
      'The Lucena position explained with diagrams: how to build the bridge with your rook and win a rook endgame with an extra pawn on the seventh rank.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/philidor-position',
    title: 'The Philidor Position: Draw a Rook Endgame | Chess Tactics Guide',
    description:
      'The Philidor position explained with diagrams: keep your rook on the sixth rank, then check from behind to hold a rook endgame a pawn down.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/wrong-colored-bishop',
    title: 'Wrong-Colored Bishop: A Draw With an Extra Piece | Chess Tactics Guide',
    description:
      'Why a bishop and a rook pawn can only draw when the bishop is the wrong color, and how the right bishop wins the same position.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/about',
    title: 'About | Chess Tactics Guide',
    description:
      'About Chess Tactics Guide: free chess training with the Woodpecker method, puzzles from the open Lichess database, blindfold drills and an endgame tablebase.',
    indexable: true,
    kind: 'info',
    priority: 0.5,
  },
  {
    path: '/privacy',
    title: 'Privacy | Chess Tactics Guide',
    description: 'What Chess Tactics Guide stores about you, how cookies and analytics work, and how to ask for your data to be deleted.',
    indexable: true,
    kind: 'info',
    priority: 0.3,
  },
  {
    path: '/contact',
    title: 'Contact | Chess Tactics Guide',
    description: 'Contact Chess Tactics Guide: report a bug, suggest an idea or ask about your account data.',
    indexable: true,
    kind: 'info',
    priority: 0.3,
  },
  {
    path: '/login',
    title: 'Sign in | Chess Tactics Guide',
    description: 'Sign in or create an account to keep your chess training results on every device, or play as a guest.',
    indexable: false,
    kind: 'app',
    priority: 0.1,
  },
  {
    path: '/statistics',
    title: 'Statistics | Chess Tactics Guide',
    description: 'Your personal records in every chess training mode, saved in your browser.',
    indexable: false,
    kind: 'app',
    priority: 0.1,
  },
];

const UNKNOWN_TITLE = `Page not found | ${SITE_NAME}`;

/** "/streak/" and "/streak" are the same page. */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function pageFor(pathname: string): PageMeta | undefined {
  const path = normalizePath(pathname);
  return PAGES.find((page) => page.path === path);
}

export function cleanSiteUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+$/i.test(value) ? value : DEFAULT_SITE_URL;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function jsonLd(page: PageMeta, siteUrl: string): string {
  const url = siteUrl + (page.path === '/' ? '/' : page.path);
  const data =
    page.kind === 'website'
      ? { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url, description: page.description }
      : page.kind === 'article'
        ? {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: page.title.split(' | ')[0],
            url,
            mainEntityOfPage: url,
            description: page.description,
            inLanguage: 'en',
            author: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
            publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
            isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: siteUrl },
          }
      : page.kind === 'info'
        ? {
            '@context': 'https://schema.org',
            '@type': page.path === '/about' ? 'AboutPage' : page.path === '/contact' ? 'ContactPage' : 'WebPage',
            name: page.title.split(' | ')[0],
            url,
            description: page.description,
            isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: siteUrl },
          }
        : {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: page.title.split(' | ')[0],
          url,
          description: page.description,
          applicationCategory: 'GameApplication',
          operatingSystem: 'Any',
          isAccessibleForFree: true,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
        };
  // "<" is escaped so the data can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Replaces the generic tags of index.html with the ones of the page (or "not found" for an unknown path). */
export function renderPage(template: string, page: PageMeta | undefined, siteUrl: string): string {
  const title = escapeHtml(page ? page.title : UNKNOWN_TITLE);
  const description = escapeHtml(page ? page.description : 'This page does not exist.');
  const url = page ? siteUrl + (page.path === '/' ? '/' : page.path) : null;
  const image = siteUrl + LOGO_PATH;
  const robots = page && page.indexable ? 'index, follow' : 'noindex, follow';

  const tags = [
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${robots}" />`,
    url ? `<link rel="canonical" href="${url}" />` : '',
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    url ? `<meta property="og:url" content="${url}" />` : '',
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    page && page.indexable ? `<script type="application/ld+json">${jsonLd(page, siteUrl)}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');

  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/\s*<meta\s+(?:name|property)="(?:description|og:title|og:description|og:type|twitter:card)"[^>]*>/gi, '')
    .replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

export function robotsTxt(siteUrl: string): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export function sitemapXml(siteUrl: string): string {
  const entries = PAGES.filter((page) => page.indexable)
    .map(
      (page) =>
        `  <url>\n    <loc>${escapeHtml(siteUrl + (page.path === '/' ? '/' : page.path))}</loc>\n    <priority>${page.priority.toFixed(1)}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
