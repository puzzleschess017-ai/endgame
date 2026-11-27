import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { ROUTE_SOURCES, chunkFiles, preloadTags, readManifest, routeSource, type Manifest } from './preload.ts';
import { renderPage } from './seo.ts';

// A small manifest in the shape Vite writes: the page files import shared files, and every page imports the main bundle.
const MANIFEST: Manifest = {
  'index.html': { file: 'assets/index-AAAA1111.js', isEntry: true },
  '_shared-BBBB2222.js': { file: 'assets/shared-BBBB2222.js', imports: ['index.html'] },
  '_deep-CCCC3333.js': { file: 'assets/deep-CCCC3333.js', imports: ['_shared-BBBB2222.js', 'index.html'] },
  'src/pages/StreakPage.tsx': { file: 'assets/StreakPage-DDDD4444.js', imports: ['index.html', '_deep-CCCC3333.js', '_shared-BBBB2222.js'] },
  'src/pages/SurvivalPage.tsx': { file: 'assets/SurvivalPage-EEEE5555.js', imports: ['index.html', '_shared-BBBB2222.js'] },
  'src/pages/theory/EndgameTheoryPage.tsx': { file: 'assets/EndgameTheoryPage-FFFF6666.js', imports: ['index.html'] },
};

describe('the files of a page', () => {
  it('are the page file and every file it imports, once each, without the main bundle', () => {
    const files = chunkFiles(MANIFEST, 'src/pages/StreakPage.tsx');
    assert.deepEqual(new Set(files), new Set(['assets/StreakPage-DDDD4444.js', 'assets/deep-CCCC3333.js', 'assets/shared-BBBB2222.js']));
    assert.equal(files.length, 3);
    assert.deepEqual(chunkFiles(MANIFEST, 'src/not/in/the/manifest.tsx'), []);
  });
  it('a lesson uses the page of its index, Home and unknown paths have none', () => {
    assert.equal(routeSource('/endgames/lucena-position'), 'src/pages/theory/EndgameTheoryPage.tsx');
    assert.equal(routeSource('/tactics/fork'), 'src/pages/theory/TacticsTheoryPage.tsx');
    assert.equal(routeSource('/streak/'), 'src/pages/StreakPage.tsx');
    assert.equal(routeSource('/'), undefined);
    assert.equal(routeSource('/nope'), undefined);
  });
});

describe('preload links', () => {
  it('the page asked for is preloaded, the others are prefetched, and no file is listed twice', () => {
    const tags = preloadTags(MANIFEST, '/streak');
    const lines = tags.split('\n').map((l) => l.trim());
    for (const file of ['StreakPage-DDDD4444', 'deep-CCCC3333', 'shared-BBBB2222']) {
      assert.ok(lines.includes(`<link rel="modulepreload" crossorigin href="/assets/${file}.js" />`), file);
    }
    assert.ok(lines.includes('<link rel="prefetch" crossorigin href="/assets/SurvivalPage-EEEE5555.js" />'));
    assert.ok(lines.includes('<link rel="prefetch" crossorigin href="/assets/EndgameTheoryPage-FFFF6666.js" />'));
    assert.ok(!lines.some((l) => l.includes('prefetch') && l.includes('shared-BBBB2222')), 'a shared file is already preloaded');
    assert.equal(new Set(lines).size, lines.length);
    assert.ok(!tags.includes('index-AAAA1111'));
  });
  it('Home prefetches every page and preloads none', () => {
    const tags = preloadTags(MANIFEST, '/');
    assert.ok(!tags.includes('modulepreload'));
    assert.ok(tags.includes('StreakPage-DDDD4444'));
  });
  it('without a manifest (dev server, old build) there is nothing to add', () => {
    assert.equal(preloadTags(undefined, '/streak'), '');
    assert.equal(readManifest('/no/such/folder'), undefined);
  });
  it('a file name that is not a plain script path is left out', () => {
    const bad: Manifest = { 'src/pages/StreakPage.tsx': { file: 'assets/x" onload="alert(1).js' } };
    assert.equal(preloadTags(bad, '/streak'), '');
  });
  it('renderPage writes them into the head, and a page without them is unchanged', () => {
    const template = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';
    const links = preloadTags(MANIFEST, '/streak');
    const out = renderPage(template, undefined, 'https://example.org', undefined, links);
    assert.ok(out.slice(0, out.indexOf('</head>')).includes('rel="modulepreload"'));
    assert.ok(!renderPage(template, undefined, 'https://example.org').includes('modulepreload'));
  });
});

describe('the table of pages', () => {
  it('lists exactly the pages that src/main.tsx loads, with the same file', () => {
    const main = fs.readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
    const fromMain: Record<string, string> = {};
    for (const m of main.matchAll(/'(\/[a-z]+)': (?:bigScreenOnly\([^,]+, )?lazy\(\(\) => import\('\.\/(.+?)'\)\)/g)) fromMain[m[1]] = `src/${m[2].replace(/^\.\//, '')}`;
    assert.ok(Object.keys(fromMain).length >= 15, 'the pattern no longer finds the pages of main.tsx');
    assert.deepEqual(ROUTE_SOURCES, fromMain);
  });
  it('every page of the table is in the manifest of the last build (when there is one)', (t) => {
    const manifest = readManifest(new URL('../dist', import.meta.url).pathname);
    if (!manifest) return t.skip('no build in dist/');
    for (const source of Object.values(ROUTE_SOURCES)) assert.ok(manifest[source], `${source} is not in the manifest`);
  });
});
