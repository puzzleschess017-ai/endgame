// Facts about the site that the legal pages show. Edit them here.

/** Where visitors can write to. While it is empty the Contact page says the address is coming. */
export const CONTACT_EMAIL = 'puzzleschess017@gmail.com';

/** Shown on the Privacy page; change it whenever the text changes. */
export const PRIVACY_UPDATED = '25 November 2026';

export const LEGAL_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
] as const;

/** Paths of the pages every visitor may read without the welcome window being in the way. */
export const INFO_PATHS: readonly string[] = LEGAL_LINKS.map((link) => link.href);

/** The endgame theory lessons are public pages too: a visitor from a search engine reads them straight away. */
export function isInfoPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return INFO_PATHS.includes(path) || path === '/endgames' || path.startsWith('/endgames/');
}
