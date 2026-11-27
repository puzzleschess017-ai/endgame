// Moving between pages without loading the whole site again. A click on a link to another page of the app is
// handled by the app itself (src/main.tsx): the address changes and the new page replaces the old one, which stays
// on the screen until the new one is ready, so there is no blank screen between two tabs. This file decides which
// clicks are the app's to handle; everything else (a new tab, a download, another site, a file) is left to the browser.

/** Index pages whose lessons live below them (/endgames/<name>). */
export const LESSON_BASES: readonly string[] = ['/endgames', '/openings', '/tactics'];

/** Addresses the server redirects: the browser must follow the redirect itself. */
const BROWSER_ONLY: readonly string[] = ['/tablebase'];

export interface ClickInfo {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export interface LinkInfo {
  /** The href as written in the page (it may be relative). */
  href: string;
  target: string;
  hasDownload: boolean;
}

export interface LocationInfo {
  origin: string;
  pathname: string;
  search: string;
}

/** "/streak/" and "/streak" are the same page; "" is "/". */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/** True for the address of a page the app shows by itself: Home, one of the `pages`, or a lesson below an index. */
export function isPagePath(pathname: string, pages: readonly string[]): boolean {
  const path = normalizePath(pathname);
  if (BROWSER_ONLY.includes(path)) return false;
  if (path === '/') return true;
  if (pages.includes(path)) return true;
  return LESSON_BASES.some((base) => path.startsWith(`${base}/`) && pages.includes(base));
}

/**
 * Where the app should go for this click (path, query and hash), or null when the browser should handle the click:
 * a modified click (new tab or window), another button, a link that opens elsewhere or downloads, another site,
 * an address that is not a page of the app (/api/..., /sitemap.xml) and a link to a place on the same page.
 */
export function internalTarget(click: ClickInfo, link: LinkInfo, here: LocationInfo, pages: readonly string[]): string | null {
  if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (link.hasDownload || (link.target && link.target !== '_self')) return null;
  let url: URL;
  try {
    url = new URL(link.href, here.origin + here.pathname + here.search);
  } catch {
    return null;
  }
  if (url.origin !== here.origin) return null;
  const path = normalizePath(url.pathname);
  if (!isPagePath(path, pages)) return null;
  if (url.hash && path === normalizePath(here.pathname) && url.search === here.search) return null;
  return path + url.search + url.hash;
}

/**
 * True when the error says that a file of the app could not be loaded (the browsers word it differently): a page whose
 * files were replaced by a deploy, or a connection that dropped.
 */
export function isChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|importing a module script failed|error loading dynamically|ChunkLoadError|Loading chunk/i.test(text);
}
