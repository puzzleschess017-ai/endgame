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

export interface PurchaseLookupOptions {
  url: string;
  key: string;
  fetchImpl?: typeof fetch;
}

/**
 * Which e-books the signed-in person has bought. Asks Supabase with the person's own token, and the row
 * level security of the table (supabase/schema.sql) returns only that person's rows. When the table is
 * missing or Supabase cannot be reached the answer is "none": a book is never given out by mistake.
 */
export function createPurchaseLookup(options: PurchaseLookupOptions): (authorization: string | undefined) => Promise<Set<string>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.url.replace(/\/+$/, '');
  return async function purchased(authorization) {
    const token = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1];
    if (!token) return new Set();
    try {
      const res = await fetchImpl(`${base}/rest/v1/ebook_purchases?select=slug`, {
        headers: { apikey: options.key, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return new Set();
      const rows = (await res.json()) as unknown;
      if (!Array.isArray(rows)) return new Set();
      const slugs = rows.map((row) => (row as { slug?: unknown } | null)?.slug);
      return new Set(slugs.filter((slug): slug is string => findEbook(slug) !== null));
    } catch {
      return new Set();
    }
  };
}
