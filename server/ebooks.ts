// E-books that come with Premium. The files are not in `public/` (which is served to everybody): they live
// in the `ebooks/` folder next to the server and are only sent by /api/ebooks/<slug> to a Premium account.
import fs from 'node:fs';
import path from 'node:path';

export interface Ebook {
  /** The part of the address after /api/ebooks/. */
  slug: string;
  /** The file in the ebooks folder. */
  file: string;
  /** The name the browser saves it under. */
  downloadName: string;
}

export const EBOOKS: Ebook[] = [
  {
    slug: 'queens-gambit',
    file: 'The-Queens-Gambit-Practical-Guide.pdf',
    downloadName: 'The-Queens-Gambit-Practical-Guide.pdf',
  },
];

export const EBOOKS_DIR = path.resolve(process.cwd(), 'ebooks');

/** The e-book with this slug, or null. Only slugs of the list above are accepted, never a path. */
export function findEbook(slug: unknown): Ebook | null {
  return typeof slug === 'string' ? (EBOOKS.find((book) => book.slug === slug) ?? null) : null;
}

/** Where the file of an e-book is, or null when it is missing from the server. */
export function ebookPath(book: Ebook, dir: string = EBOOKS_DIR): string | null {
  const file = path.join(dir, book.file);
  return fs.existsSync(file) ? file : null;
}
