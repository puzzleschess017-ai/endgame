// The e-books on sale in the eBooks tab. This list is only what the page shows: the PDF files and the
// rule of who may download them are on the server (server/ebooks.ts, src/utils/access.ts).
export interface EbookInfo {
  /** The part of the address after /api/ebooks/, also the name of the cover in public/covers/. */
  slug: string;
  title: string;
  subtitle: string;
  pages: number;
  /** What is inside, in a sentence or two. */
  blurb: string;
  /** File name the browser saves the PDF under. */
  downloadName: string;
}

/** The price of one e-book. Premium has all of them for free. */
export const EBOOK_PRICE_LABEL = '$1.99';

/** False until the payment provider is connected: the Buy button then says that buying opens soon. */
export const PURCHASES_OPEN = false;

export const EBOOKS: EbookInfo[] = [
  {
    slug: 'queens-gambit',
    title: 'The Queen’s Gambit: A Practical Guide',
    subtitle: 'Ideas, plans, traps and exercises for 1.d4 d5 2.c4',
    pages: 39,
    blurb:
      'Eight chapters on the Accepted, the Declined, the Slav and the counterpunches, seven exercises with solutions and a cheat sheet. Every line was replayed by computer and every evaluation comes from Stockfish.',
    downloadName: 'The-Queens-Gambit-Practical-Guide.pdf',
  },
];
