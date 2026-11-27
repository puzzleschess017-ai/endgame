import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

// The production server is started with plain `node server.ts` (npm start), which resolves imports exactly as written:
// an import without ".ts" works under tsx and vite but crashes the real server ("Cannot find module"), and the deploy fails.
// So load the modules the server uses with plain node, the way production does.
const ROOT = path.resolve(import.meta.dirname, '..');

for (const file of ['server/prerender.ts', 'server/seo.ts', 'src/utils/pricing.ts', 'src/utils/access.ts']) {
  test(`${file} loads with plain node (every import has its ".ts")`, () => {
    const out = execFileSync(process.execPath, ['-e', `import('./${file}').then(() => console.log('ok'))`], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
    assert.equal(out.trim(), 'ok');
  });
}
