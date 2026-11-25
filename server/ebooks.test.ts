import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { EBOOKS as SHOWN } from '../src/utils/ebooks.ts';
import { EBOOKS, EBOOKS_DIR, createPurchaseLookup, ebookPath, findEbook } from './ebooks.ts';

describe('e-books', () => {
  it('finds a book by its slug only', () => {
    assert.equal(findEbook('queens-gambit')?.file, 'The-Queens-Gambit-Practical-Guide.pdf');
    for (const bad of ['', 'QUEENS-GAMBIT', '../server.ts', 'queens-gambit/../x', undefined, null, 5, ['queens-gambit']]) {
      assert.equal(findEbook(bad), null, String(bad));
    }
  });
  it('every book of the list is a plain file name that exists on the server', () => {
    for (const book of EBOOKS) {
      assert.match(book.file, /^[A-Za-z0-9._-]+\.pdf$/);
      assert.ok(ebookPath(book), `${book.file} is missing from ${EBOOKS_DIR}`);
    }
  });
  it('the books the page shows are the books the server has, with the same file name and a cover', () => {
    assert.deepEqual(SHOWN.map((b) => b.slug).sort(), EBOOKS.map((b) => b.slug).sort());
    for (const shown of SHOWN) {
      assert.equal(shown.downloadName, findEbook(shown.slug)?.downloadName);
      assert.ok(fs.existsSync(new URL(`../public/covers/${shown.slug}.webp`, import.meta.url)), `cover of ${shown.slug}`);
    }
  });
  it('reports a missing file as null', () => {
    assert.equal(ebookPath(EBOOKS[0], '/nonexistent-folder'), null);
  });
});

describe('purchases lookup', () => {
  const ROWS = [{ slug: 'queens-gambit' }, { slug: 'not-a-book' }, { slug: '../x' }, null];
  function lookup(handler: (url: string, headers: Record<string, string>) => Response | Promise<Response>) {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: String(input), headers });
      return handler(String(input), headers);
    }) as typeof fetch;
    return { calls, purchased: createPurchaseLookup({ url: 'https://x.example/', key: 'KEY', fetchImpl }) };
  }

  it('asks Supabase with the person’s own token and keeps only known books', async () => {
    const { calls, purchased } = lookup(() => Response.json(ROWS));
    assert.deepEqual([...(await purchased('Bearer abc'))], ['queens-gambit']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://x.example/rest/v1/ebook_purchases?select=slug');
    assert.deepEqual(calls[0].headers, { apikey: 'KEY', Authorization: 'Bearer abc' });
  });
  it('asks nothing when nobody is signed in', async () => {
    const { calls, purchased } = lookup(() => Response.json(ROWS));
    for (const header of [undefined, '', 'Basic abc', 'Bearer']) assert.equal((await purchased(header)).size, 0);
    assert.equal(calls.length, 0);
  });
  it('gives nothing when the table is missing, the token is refused, the answer is odd or Supabase is down', async () => {
    for (const handler of [
      () => new Response('{}', { status: 404 }),
      () => new Response('{}', { status: 401 }),
      () => Response.json({ not: 'a list' }),
      () => new Response('not json', { status: 200 }),
      () => {
        throw new Error('offline');
      },
    ]) {
      const { purchased } = lookup(handler);
      assert.equal((await purchased('Bearer abc')).size, 0);
    }
  });
});
