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
    path: '/analysis',
    title: 'Board Analysis | Chess Tactics Guide',
    description:
      'Board analysis: set up or load any chess position, play moves on the board and check them with the Stockfish engine.',
    indexable: true,
    kind: 'app',
    priority: 0.8,
  },
  {
    path: '/editor',
    title: 'Board Editor | Chess Tactics Guide',
    description: 'Free chess board editor: set up any position, then copy the FEN or check it in Board Analysis.',
    indexable: true,
    kind: 'app',
    priority: 0.6,
  },
  {
    path: '/endgames',
    title: 'Chess Endgame Theory and Lessons | Chess Tactics Guide',
    description:
      'Free chess endgame lessons with diagrams: the Lucena and Philidor positions, the opposition, the rule of the square, basic mates, stalemate tricks and more.',
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
    path: '/endgames/rule-of-the-square',
    title: 'The Rule of the Square in Pawn Endings | Chess Tactics Guide',
    description:
      'The rule of the square explained with diagrams: see at a glance whether a king can catch a passed pawn, and why the side to move matters.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/queen-vs-pawn-on-the-seventh',
    title: 'Queen vs Pawn on the Seventh Rank | Chess Tactics Guide',
    description:
      'Queen against a pawn on the seventh rank: when the bishop pawn or the rook pawn draws by stalemate, and when the queen wins. With diagrams.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/bishop-and-knight-mate',
    title: 'Checkmate With Bishop and Knight | Chess Tactics Guide',
    description:
      'How to checkmate with a bishop and a knight: drive the king to the corner of the bishop\'s color and finish with the knight. With diagrams.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/two-bishops-mate',
    title: 'Checkmate With Two Bishops | Chess Tactics Guide',
    description:
      'How to checkmate with two bishops of opposite colors: build a wall, push the king to the edge and finish with the king\'s help. With diagrams.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/two-knights-vs-king',
    title: 'Two Knights vs King: Why It Is a Draw | Chess Tactics Guide',
    description:
      'Why two knights cannot force checkmate against a lone king, the one mate that works if the defender errs, and what to do in practice.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/endgames/stalemate-tricks',
    title: 'Stalemate: Avoid It, or Use It to Draw | Chess Tactics Guide',
    description:
      'Typical stalemate traps with a queen, a rook and a pawn, with diagrams: how to avoid them when you are winning and use them when you are losing.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings',
    title: 'Chess Opening Theory and Lessons | Chess Tactics Guide',
    description:
      'Free chess opening lessons with diagrams: the Italian, Ruy Lopez, Scotch, Sicilian, French, Caro-Kann, Queen\'s Gambit, London and more.',
    indexable: true,
    kind: 'info',
    priority: 0.8,
  },
  {
    path: '/openings/italian-game',
    title: 'The Italian Game: Quick Development and Attack | Chess Tactics Guide',
    description:
      'The Italian Game explained with diagrams: the Giuoco Piano, the Two Knights Defence, the ideas behind 3.Bc4 and the plans for both sides.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/ruy-lopez',
    title: 'The Ruy Lopez: The Classic Spanish Opening | Chess Tactics Guide',
    description:
      'The Ruy Lopez explained with diagrams: the Closed Variation, the Berlin Defence and the main plans after 1.e4 e5 2.Nf3 Nc6 3.Bb5.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/sicilian-defense',
    title: 'The Sicilian Defence: Fight for the Win as Black | Chess Tactics Guide',
    description:
      'The Sicilian Defence explained with diagrams: the idea of 1...c5, the Najdorf, the Dragon and how to meet White\'s side lines.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/french-defense',
    title: 'The French Defence: Solid With Counterplay | Chess Tactics Guide',
    description:
      'The French Defence explained with diagrams: the Winawer, the Advance Variation, the bad bishop problem and Black\'s pawn breaks ...c5 and ...f6.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/caro-kann-defense',
    title: 'The Caro-Kann Defence: Solid and Reliable | Chess Tactics Guide',
    description:
      'The Caro-Kann Defence explained with diagrams: the Classical and Advance Variations, and how to develop the bishop before closing the chain.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/queens-gambit',
    title: 'The Queen\'s Gambit: Classic Play With 1.d4 | Chess Tactics Guide',
    description:
      'The Queen\'s Gambit explained with diagrams: how Black declines or accepts the pawn, the main plans for both sides and the key pawn breaks.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/scotch-game',
    title: 'The Scotch Game: Open the Centre at Once | Chess Tactics Guide',
    description:
      'The Scotch Game explained with diagrams: how 3.d4 opens the centre, the Classical Variation with 4...Bc5 and the Mieses Variation with 4...Nf6.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/scandinavian-defense',
    title: 'The Scandinavian Defence: Hit e4 at Once | Chess Tactics Guide',
    description:
      'The Scandinavian Defence explained with diagrams: 1...d5, the queen recapture on d5, the modern 2...Nf6 line and the plans for both sides.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/london-system',
    title: 'The London System: A Simple Set-Up With 1.d4 | Chess Tactics Guide',
    description:
      'The London System explained with diagrams: the Bf4 set-up with e3, c3 and Nbd2, the typical plans and how to meet ...c5 and ...Qb6.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/kings-indian-defense',
    title: 'The King\'s Indian Defence: Strike the Centre | Chess Tactics Guide',
    description:
      'The King\'s Indian Defence explained with diagrams: how Black lets White take the centre, then attacks it with ...e5 and a kingside pawn storm.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/nimzo-indian-defense',
    title: 'The Nimzo-Indian Defence: Pin and Control e4 | Chess Tactics Guide',
    description:
      'The Nimzo-Indian Defence explained with diagrams: the pin on c3, the Rubinstein 4.e3 and Classical 4.Qc2 variations and the ideas for both sides.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/openings/english-opening',
    title: 'The English Opening: Fight From the Flank | Chess Tactics Guide',
    description:
      'The English Opening explained with diagrams: 1.c4, the reversed Sicilian after 1...e5, the symmetrical 1...c5 and the typical plans.',
    indexable: true,
    kind: 'article',
    priority: 0.7,
  },
  {
    path: '/ebooks',
    title: 'Chess eBooks: The Queen’s Gambit and more | Chess Tactics Guide',
    description:
      'Chess e-books with diagrams, plans, traps and exercises, every line checked by computer. $1.99 each, free with Premium.',
    indexable: true,
    kind: 'info',
    priority: 0.6,
  },
  {
    path: '/about',
    title: 'About | Chess Tactics Guide',
    description:
      'About Chess Tactics Guide: free chess training with the Woodpecker method, puzzles from the open Lichess database, blindfold drills and an engine for board analysis.',
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
