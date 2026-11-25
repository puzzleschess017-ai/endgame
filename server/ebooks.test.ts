import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EBOOKS, EBOOKS_DIR, ebookPath, findEbook } from './ebooks.ts';

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
  it('reports a missing file as null', () => {
    assert.equal(ebookPath(EBOOKS[0], '/nonexistent-folder'), null);
  });
});
