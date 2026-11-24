// Facts about the site that the legal pages show. Edit them here.

/** Where visitors can write to. While it is empty the Contact page says the address is coming. */
export const CONTACT_EMAIL = '';

/** Shown on the Privacy page; change it whenever the text changes. */
export const PRIVACY_UPDATED = '25 November 2026';

export const LEGAL_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
] as const;

/** Paths of the pages every visitor may read without the welcome window being in the way. */
export const INFO_PATHS: readonly string[] = LEGAL_LINKS.map((link) => link.href);

export function isInfoPath(pathname: string): boolean {
  return INFO_PATHS.includes(pathname.replace(/\/+$/, '') || '/');
}
