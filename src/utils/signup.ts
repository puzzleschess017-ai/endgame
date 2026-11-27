// Where a guest (nobody signed in) is shown the green "Create account" button at the top of the page. A guest can use the
// training pages for as long as they like and may never notice that an account keeps their results on every device, so the
// pages where they spend their time carry the button. Home has its own welcome card, Blindfold and the pricing page already
// say it, and the legal pages are not a place to ask.

const PREFIXES = [
  '/woodpecker',
  '/streak',
  '/survival',
  '/coordinates',
  '/editor',
  '/analysis',
  // the library: the theory lessons and the e-books
  '/endgames',
  '/openings',
  '/tactics',
  '/ebooks',
];

/** True for these pages and the pages under them (a lesson is /endgames/<name>). */
export function showsSignupPrompt(path: string): boolean {
  const clean = path.replace(/\/+$/, '') || '/';
  return PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

/** The sign-up tab of the login page, which comes back to this page afterwards. */
export function signUpHref(path: string): string {
  return `/login?tab=signup&next=${encodeURIComponent(path)}`;
}
