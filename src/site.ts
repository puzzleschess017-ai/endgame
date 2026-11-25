// Facts about the site that the legal pages show. Edit them here.

/** Where visitors can write to. While it is empty the Contact page says the address is coming. */
export const CONTACT_EMAIL = 'puzzleschess017@gmail.com';

/** Shown on the Privacy page; change it whenever the text changes. */
export const PRIVACY_UPDATED = '25 November 2026';

/** Shown on the Terms and Refund pages; change it whenever their text changes. */
export const TERMS_UPDATED = '25 November 2026';
export const REFUND_UPDATED = '25 November 2026';

/** How many days after a payment the buyer may ask for the money back (the Refund page and the Pricing FAQ say it). */
export const REFUND_DAYS = 14;

export const LEGAL_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/contact', label: 'Contact' },
] as const;

/**
 * The welcome window: a first-time visitor is asked to create an account, sign in or play as a guest, over a blurred page.
 * It is switched off, so everybody lands on the page they opened (as a guest until they sign in). Set to true to bring it back.
 */
export const WELCOME_WINDOW = false;

/** Paths of the pages every visitor may read without the welcome window being in the way. */
export const INFO_PATHS: readonly string[] = LEGAL_LINKS.map((link) => link.href);

/** The endgame and opening theory lessons are public pages too: a visitor from a search engine reads them straight away. */
export function isInfoPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (
    INFO_PATHS.includes(path) ||
    path === '/endgames' ||
    path.startsWith('/endgames/') ||
    path === '/openings' ||
    path.startsWith('/openings/')
  );
}
