// Tells the browser which files a page needs before it has asked for them. The app loads every page with
// import() (src/main.tsx), so without help the browser first downloads and runs the main bundle, only then learns
// which page file it needs, and only after that which shared files that page needs: a chain of three requests, with
// a blank dark screen all the time. The server knows the path that was asked for, so it writes the files of that
// page into the HTML (modulepreload: fetched together with the main bundle), and asks the browser to fetch the files
// of all the other pages when it is idle (prefetch), so the next tab is already in the cache. The names of the files
// come from the Vite manifest of the build (dist/.vite/manifest.json).

import fs from 'node:fs';
import path from 'node:path';

export interface ManifestEntry {
  file: string;
  imports?: string[];
  isEntry?: boolean;
}
export type Manifest = Record<string, ManifestEntry>;

/** The source file of the page each path loads: the same table as PAGES in src/main.tsx (a test compares the two). */
export const ROUTE_SOURCES: Record<string, string> = {
  '/woodpecker': 'src/App.tsx',
  '/coordinates': 'src/pages/CoordinatesPage.tsx',
  '/streak': 'src/pages/StreakPage.tsx',
  '/survival': 'src/pages/SurvivalPage.tsx',
  '/blindfold': 'src/pages/BlindfoldPage.tsx',
  '/statistics': 'src/pages/StatisticsPage.tsx',
  '/editor': 'src/pages/EditorPage.tsx',
  '/analysis': 'src/pages/AnalysisPage.tsx',
  '/tablebase': 'src/pages/AnalysisPage.tsx',
  '/login': 'src/pages/LoginPage.tsx',
  '/endgames': 'src/pages/theory/EndgameTheoryPage.tsx',
  '/openings': 'src/pages/theory/OpeningTheoryPage.tsx',
  '/tactics': 'src/pages/theory/TacticsTheoryPage.tsx',
  '/ebooks': 'src/pages/EbooksPage.tsx',
  '/pricing': 'src/pages/PricingPage.tsx',
  '/about': 'src/pages/legal/AboutPage.tsx',
  '/privacy': 'src/pages/legal/PrivacyPage.tsx',
  '/terms': 'src/pages/legal/TermsPage.tsx',
  '/refunds': 'src/pages/legal/RefundPage.tsx',
  '/contact': 'src/pages/legal/ContactPage.tsx',
};

/** A lesson (/endgames/<name>) is shown by the page of its index. */
const LESSON_BASES = ['/endgames', '/openings', '/tactics'];

/** The manifest of the build, or undefined when there is none (the dev server, an old build). */
export function readManifest(distDir: string): Manifest | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(distDir, '.vite', 'manifest.json'), 'utf8')) as Manifest;
  } catch {
    return undefined;
  }
}

/** The source file of the page at this path, or undefined for Home (it is in the main bundle) and unknown paths. */
export function routeSource(pathname: string): string | undefined {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (ROUTE_SOURCES[clean]) return ROUTE_SOURCES[clean];
  const base = LESSON_BASES.find((b) => clean.startsWith(`${b}/`));
  return base ? ROUTE_SOURCES[base] : undefined;
}

/** The files of a page: its own file and every shared file it imports, except the main bundle the browser has already. */
export function chunkFiles(manifest: Manifest, source: string): string[] {
  const files = new Set<string>();
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const entry = manifest[key];
    if (!entry || entry.isEntry) return;
    files.add(entry.file);
    for (const child of entry.imports ?? []) visit(child);
  };
  visit(source);
  return [...files];
}

const SAFE_FILE = /^[A-Za-z0-9_./-]+\.js$/;

/** The <link> tags for the head of the page at this path: its own files first, the files of every other page after them. */
export function preloadTags(manifest: Manifest | undefined, pathname: string): string {
  if (!manifest) return '';
  const own = routeSource(pathname);
  const ownFiles = own ? chunkFiles(manifest, own) : [];
  const taken = new Set(ownFiles);
  const otherFiles: string[] = [];
  for (const source of new Set(Object.values(ROUTE_SOURCES))) {
    if (source === own) continue;
    for (const file of chunkFiles(manifest, source)) {
      if (!taken.has(file)) {
        taken.add(file);
        otherFiles.push(file);
      }
    }
  }
  const tag = (rel: string, file: string) => (SAFE_FILE.test(file) ? `<link rel="${rel}" crossorigin href="/${file}" />` : '');
  return [...ownFiles.map((file) => tag('modulepreload', file)), ...otherFiles.map((file) => tag('prefetch', file))].filter(Boolean).join('\n    ');
}
